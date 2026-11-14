import test from 'node:test';
import assert from 'node:assert/strict';
import { UNDERFLOOR, inRect, underfloorPlan, underfloorHead } from '../public/world/backrooms/underfloor-layout.js';

test('underfloor center route and every refuge fit the player without removing structural walls', () => {
  for (const [W, D] of [[11.8, 19.8], [10, 18], [14, 24]]) {
    const p = underfloorPlan(W, D), radius = .225;
    const free = (x, z) => !p.solids.some(b => {
      const dx = Math.max(b.x0 - x, 0, x - b.x1), dz = Math.max(b.z0 - z, 0, z - b.z1);
      return dx * dx + dz * dz < radius * radius;
    });
    for (let z = -D / 2 + .5; z < D / 2 - .5; z += .1) assert.ok(free(0, z), `center blocked at ${z}`);
    for (const s of p.shelters) for (let a = 0; a <= 1; a += .025) assert.ok(free(s.center.x * a, s.center.z));
    assert.ok(p.solids.length > 0);
  }
});

test('all crawl clearances and refuges remain passable as each physical span flexes', () => {
  const p = underfloorPlan();
  for (const active of [0, 1, 2]) for (let pressure = 0; pressure <= 1; pressure += .05) {
    const step = { active, pressure };
    for (const q of [p.entry, p.exit, ...p.shelters.map(s => s.center)]) {
      assert.ok(underfloorHead(p, q.x, q.z, step) >= .62);
    }
    for (let z = -p.end; z < p.end; z += .2) assert.ok(underfloorHead(p, 0, z, step) >= .62);
    for (const refuge of p.shelters) assert.equal(underfloorHead(p, refuge.center.x, refuge.center.z, step), UNDERFLOOR.bayHead);
  }
});

test('planned spans are separate and the lowered boards agree with minimum crawl clearance', () => {
  const p = underfloorPlan(), s = { active: 0, pressure: 1 }, b = p.crossings[s.active];
  assert.ok(Math.abs(underfloorHead(p, 0, b.z, s) - .82) < 1e-10);
  for (const other of p.crossings.filter(q => q.id !== b.id)) assert.equal(inRect({ x: 0, z: other.z }, b), false);
  assert.equal(underfloorHead(p, 0, p.entry.z), 3.2);
  for (const sign of [-1, 1]) {
    assert.equal(underfloorHead(p, 0, sign * (p.end + .15)), .86);
    assert.equal(underfloorHead(p, 0, sign * (p.end + .38)), .86);
    assert.equal(underfloorHead(p, 0, sign * (p.end + .4)), 3.2);
  }
  for (const dims of [[8, 18], [11.8, 17], [NaN, 20], [11.8, Infinity]]) assert.throws(() => underfloorPlan(...dims), RangeError);
  assert.deepEqual(underfloorPlan(), underfloorPlan());
});
