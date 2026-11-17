// A creature that works a handle stands in the doorway's line, on the side the leaves swing into. A leaf swings a quarter of a
// circle about its hinge (doorleaf.js), so a body that waits too near goes through it. cast/walk.js swingClearance() is how far
// back it has to wait; here a leaf is swept through all of its swing past a body standing there.
import test from 'node:test';
import assert from 'node:assert/strict';
import { swingClearance, WAIT } from '../public/world/backrooms/cast/walk.js';
import { DOORS } from '../public/world/backrooms/doors.js';

const WIDTHS = [0.9, 1.0, 1.2, 1.5, 1.8, DOORS.widest];       // the doorways that can be hung (doors.js: no wider than `widest`)
const RADII = [0.2, 0.25, 0.3, 0.4, 0.5];                     // the bodies in the cast (cast/pirate.js BODY 0.3 and the rest)
const HALF_THICK = DOORS.thick / 2;

/** The least gap, metres, between a body at (0, out) of radius r and either leaf of doors `w` wide, over the whole swing. */
function leastGap(w, out, r) {
  const half = w / 2, L = half - 0.012; let least = Infinity;
  for (const side of [-1, 1]) {
    const hx = side * (half + HALF_THICK);                                    // the hinge: just outside the jamb
    for (let deg = 0; deg <= 90; deg += 0.5) {
      const a = (deg * Math.PI) / 180, dx = -side * Math.cos(a), dz = Math.sin(a);   // closed: across the opening; open: out into the room
      for (let t = 0; t <= L; t += 0.005) {
        const gap = Math.hypot(hx + dx * t - 0, dz * t - out) - HALF_THICK - r;
        if (gap < least) least = gap;
      }
    }
  }
  return least;
}

test('a body that waits swingClearance() from the wall is never touched by a leaf, for every width and every body', () => {
  for (const w of WIDTHS) for (const r of RADII) {
    const out = swingClearance(w, r);
    assert.ok(Number.isFinite(out) && out > 0, `${w} m doors, r ${r}: a distance`);
    assert.ok(leastGap(w, out, r) >= -1e-6, `${w} m doors, r ${r}: waiting ${out.toFixed(2)} m out, a leaf comes within ${leastGap(w, out, r).toFixed(3)} m of it`);
  }
});

test('…and not much further back than it must: the creature does not hang about in the middle of the room', () => {
  for (const w of WIDTHS) for (const r of RADII) {
    const out = swingClearance(w, r);
    assert.ok(leastGap(w, out, r) < 0.1, `${w} m doors, r ${r}: ${out.toFixed(2)} m out leaves ${leastGap(w, out, r).toFixed(2)} m to spare`);
  }
});

test('the old waiting place (0.45 m from the wall face) was in the sweep of the doors for everything but the narrowest doors and smallest bodies', () => {
  let touched = 0, total = 0;
  for (const w of WIDTHS) for (const r of RADII) { total++; if (leastGap(w, WAIT, r) < -0.005) touched++; }
  assert.ok(touched > total / 2, `${touched} of ${total} width and body pairs were swept at the old place`);
  assert.ok(leastGap(1.5, WAIT, 0.3) < -0.05, 'the mascot (r 0.3) at doors 1.5 m wide: a leaf goes through it by a hand or more');
});

test('wider doors and bigger bodies wait further back, never nearer', () => {
  for (const r of RADII) for (let i = 1; i < WIDTHS.length; i++) assert.ok(swingClearance(WIDTHS[i], r) >= swingClearance(WIDTHS[i - 1], r) - 1e-9, `r ${r}`);
  for (const w of WIDTHS) for (let i = 1; i < RADII.length; i++) assert.ok(swingClearance(w, RADII[i]) >= swingClearance(w, RADII[i - 1]) - 1e-9, `w ${w}`);
});
