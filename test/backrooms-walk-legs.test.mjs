// walk-legs.js: legs modelled into one mesh with the body walk by turning its own vertices below the hip — by how far it
// has gone, not by the clock; nothing above the hip, or kept, ever moves; standing still, nothing is redrawn.
import test from 'node:test';
import assert from 'node:assert/strict';
import { legsOf, legsFor } from '../public/world/backrooms/walk-legs.js';

// a stand-in mesh: a left foot, a right foot, a knee, a hip-high point, a chest point and a hanging hand
const fake = () => {
  const pos = [-0.1, 0.0, 0.05, 0.1, 0.0, 0.05, -0.1, 0.25, 0, 0, 0.6, 0, 0, 1.1, 0, -0.3, 0.2, 0];
  const nor = pos.map((_, i) => (i % 3 === 1 ? 127 : 0));
  const attr = (a) => ({ array: Float32Array.from(a), needsUpdate: false });
  return { geometry: { attributes: { position: attr(pos), normal: attr(nor) } } };
};
const P = (m, i) => Array.from(m.geometry.attributes.position.array.slice(i * 3, i * 3 + 3));

test('a thigh turned forward takes its foot forward and up; the other leg, the body and what is kept do not move', () => {
  const m = fake(), set = legsOf(m, { hip: 0.5, knee: 0.25, keep: (x) => Math.abs(x) > 0.2 });
  set(-0.4, 0, 0, 0);
  const [, y, z] = P(m, 0);
  assert.ok(z > 0.15 && y > 0.05, `left foot at y ${y}, z ${z}`);
  assert.deepEqual(P(m, 1).map((v) => +v.toFixed(5)), [0.1, 0, 0.05]);
  assert.deepEqual(P(m, 4), [0, 1.100000023841858, 0]);
  assert.deepEqual(P(m, 5).map((v) => +v.toFixed(5)), [-0.3, 0.2, 0]);
});

test('a knee folds its shin back, not forward', () => {
  const m = fake(), set = legsOf(m, { hip: 0.5, knee: 0.25 });
  set(0, 0.8, 0, 0);
  assert.ok(P(m, 0)[2] < 0, 'the foot goes behind');
  assert.ok(Math.abs(P(m, 2)[2]) < 1e-6, 'the knee itself stays where it was');
});

test('it steps by distance: standing it stays put, walking it moves its feet, and it comes back to standing', () => {
  const m = fake(), step = legsFor(m, { hip: 0.5, knee: 0.25 });
  const rest = P(m, 0);
  let t = 0;
  for (let i = 0; i < 30; i++) step(0, 0, (t += 1 / 30));
  assert.deepEqual(P(m, 0), rest, 'standing: nothing moved');
  let moved = false;
  for (let i = 0; i < 60; i++) { step(i * 0.04, 0, (t += 1 / 30)); if (Math.abs(P(m, 0)[2] - rest[2]) > 0.02) moved = true; }
  assert.ok(moved, 'walking: the foot went');
  for (let i = 0; i < 120; i++) step(2.36, 0, (t += 1 / 30));
  assert.ok(Math.abs(P(m, 0)[2] - rest[2]) < 0.01, 'and stopped, it stands again');
});

test('put somewhere (a jump), it does not walk', () => {
  const m = fake(), step = legsFor(m, { hip: 0.5, knee: 0.25 }), rest = P(m, 0);
  step(0, 0, 0); step(3, 0, 0.033); step(3, 0, 0.066);
  assert.deepEqual(P(m, 0), rest);
});
