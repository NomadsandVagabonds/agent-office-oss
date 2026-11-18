// The Trunk Line's cables (rooms/cable-drop/cord.js): they keep their length, hang under their weight, lag behind a root
// that moves, lie on the floor rather than through it, and come out the same however the frames fall.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createCord, stepCord, settleCord, CORD_STEP } from '../public/world/backrooms/rooms/cable-drop/cord.js';

const lengths = (c) => Array.from({ length: c.n }, (_, i) => Math.hypot(c.p[i * 3 + 3] - c.p[i * 3], c.p[i * 3 + 4] - c.p[i * 3 + 1], c.p[i * 3 + 5] - c.p[i * 3 + 2]));
const tip = (c) => c.p.slice(c.n * 3, c.n * 3 + 3);

test('a slack cable laid out sideways falls and hangs straight down from its root, its length kept', () => {
  const c = createCord(6, 0.1, 0, 2, 0, 1, 0, 0);
  for (let i = 0; i < 600; i++) stepCord(c, 1 / 60, { root: [0, 2, 0], dir: [0, -1, 0], drag: 1.5 });
  const [x, y] = tip(c);
  assert.ok(Math.abs(x) < 0.05 && Math.abs(y - 1.4) < 0.05, `tip at ${x}, ${y}`);
  for (const l of lengths(c)) assert.ok(Math.abs(l - 0.1) < 0.01);
});

test('when its root moves off, the cable trails behind it, then catches up', () => {
  const c = createCord(6, 0.1, 0, 2, 0);
  let x = 0;
  for (let i = 0; i < 20; i++) { x += 3 / 60; stepCord(c, 1 / 60, { root: [x, 2, 0], dir: [0, -1, 0] }); }
  assert.ok(tip(c)[0] < x - 0.1, 'trailing');
  for (let i = 0; i < 600; i++) stepCord(c, 1 / 60, { root: [x, 2, 0], dir: [0, -1, 0], drag: 1.5 });
  assert.ok(Math.abs(tip(c)[0] - x) < 0.05, 'caught up');
});

test('it lies on the floor, not through it', () => {
  const c = createCord(8, 0.2, 0, 1, 0);
  for (let i = 0; i < 300; i++) stepCord(c, 1 / 60, { root: [0, 1, 0], dir: [0, -1, 0], floor: 0.02 });
  for (let i = 0; i <= c.n; i++) assert.ok(c.p[i * 3 + 1] >= 0.02 - 1e-9);
});

test('a stiff cable holds its shape against its weight; it reaches toward what it is pulled to', () => {
  const c = createCord(6, 0.2, 0, 2, 0, 0, 0, 1);
  for (let i = 0; i < 300; i++) stepCord(c, 1 / 60, { root: [0, 2, 0], dir: [0, 0, 1], stiff: 1, drag: 2 });
  assert.ok(tip(c)[1] > 1.2, 'held out, not hanging');
  const r = createCord(6, 0.2, 0, 2, 0);
  for (let i = 0; i < 300; i++) stepCord(r, 1 / 60, { root: [0, 2, 0], dir: [0, -1, 0], reach: [0, 2, 1.5], pull: 5 });
  assert.ok(tip(r)[2] > 0.6, 'the tip goes for it');
});

test('the same seconds give the same cable, in big frames or small', () => {
  const a = createCord(5, 0.1, 0, 2, 0, 1, 0, 0), b = createCord(5, 0.1, 0, 2, 0, 1, 0, 0);
  for (let i = 0; i < 60; i++) stepCord(a, 1 / 60, { root: [0, 2, 0] });
  for (let i = 0; i < 20; i++) stepCord(b, 3 / 60, { root: [0, 2, 0] });
  for (let i = 0; i < a.p.length; i++) assert.ok(Math.abs(a.p[i] - b.p[i]) < 1e-9);
  settleCord(a, 0, 0, 0);
  assert.ok(Math.abs(tip(a)[1] + 0.5) < 1e-9);
  assert.ok(CORD_STEP > 0);
});
