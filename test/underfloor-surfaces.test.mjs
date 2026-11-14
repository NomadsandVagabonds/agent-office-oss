import test from 'node:test';
import assert from 'node:assert/strict';
import { UNDERFLOOR, underfloorPlan, underfloorSurfacePlan } from '../public/world/backrooms/underfloor-layout.js';

const area = b => (b.x1 - b.x0) * (b.z1 - b.z0);
const overlap = (a, b) => Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) *
  Math.max(0, Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0));
const close = (a, b, label) => assert.ok(Math.abs(a - b) < 1e-9, `${label}: ${a} != ${b}`);
const sizes = [[11.8, 19.8], [9, 18], [15, 24.4]];

test('underfloor roof and grate openings exactly partition the deck without coplanar overlap', () => {
  for (const [W, D] of sizes) {
    const plan = underfloorPlan(W, D), shell = underfloorSurfacePlan(plan);
    const regions = [...shell.fixed, ...shell.patches.flat(), ...shell.apertures];
    for (const b of regions) {
      assert.ok(area(b) > 0, 'each surface has positive extent');
      assert.ok(b.x0 >= -W / 2 && b.x1 <= W / 2 && b.z0 >= -plan.end && b.z1 <= plan.end);
    }
    for (let i = 0; i < regions.length; i++) for (let j = i + 1; j < regions.length; j++) {
      close(overlap(regions[i], regions[j]), 0, `surface overlap ${i}/${j}`);
    }
    close(regions.reduce((sum, b) => sum + area(b), 0), W * plan.end * 2, 'complete deck area');
    // This separately checks the original failure: a pressure patch generated
    // with a different plank origin extended into the neighbouring fixed roof.
    for (const fixed of shell.fixed) for (const moving of shell.patches.flat()) {
      close(overlap(fixed, moving), 0, 'fixed versus moving roof');
    }
  }
});

test('each moving span frames one real unobstructed aperture in encounter order', () => {
  for (const dims of sizes) {
    const plan = underfloorPlan(...dims), shell = underfloorSurfacePlan(plan);
    plan.crossings.forEach((crossing, i) => {
      const aperture = shell.apertures[i], patch = shell.patches[i];
      assert.equal(aperture.id, crossing.id);
      close((aperture.z0 + aperture.z1) / 2, crossing.z, 'grate center');
      assert.ok(aperture.x1 - aperture.x0 >= 1.19 && aperture.z1 - aperture.z0 >= 1.19);
      for (const b of [...shell.fixed, ...shell.patches.flat(), ...plan.solids]) {
        close(overlap(b, aperture), 0, 'no board or masonry inside the grate opening');
      }
      for (const b of patch) close(overlap(b, crossing), area(b), 'moving board stays within span');
      close(patch.reduce((sum, b) => sum + area(b), area(aperture)), area(crossing), 'complete moving span');
      assert.ok(shell.handSlot.x0 > aperture.x0 && shell.handSlot.x1 < aperture.x1);
      assert.ok(shell.handSlot.x1 - shell.handSlot.x0 >= .36, 'central reach slot fits palm');
    });
  }
});

test('structural caps are below the deck and moving spans clear all masonry piers', () => {
  const plan = underfloorPlan(), shell = underfloorSurfacePlan(plan);
  assert.ok(shell.pierTop < shell.bottom, 'masonry top cannot fight with the deck top or underside');
  assert.ok(shell.top > shell.bottom);
  assert.equal(shell.bottom, UNDERFLOOR.ceiling);
  assert.equal(shell.headerBottom, UNDERFLOOR.bayHead);
  for (const solid of plan.solids) for (const patch of shell.patches.flat()) {
    close(overlap(solid, patch), 0, 'bending wood does not pass through pier caps');
  }
  assert.ok(shell.bottom - UNDERFLOOR.flex >= .8, 'the lowest moving surface retains crawl clearance');
});
