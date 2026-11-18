// player.js: being put somewhere free keeps you on your own floor (the Flume Knot's tube: a toner's body beside the visitor put them
// over the lip, 2.3 m down); and a careful crawl (C held, stooped under something low) is quiet enough for what listens (< 0.92 m/s).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlayer, CREEP } from '../public/world/backrooms/player.js';

const cam = () => ({ position: { set() {} }, rotation: { set() {} } });
const input = (keys = []) => ({ keys: new Set(keys), dx: 0, dy: 0, stick: { x: 0, y: 0 }, hurry: false });
const run = (p, seconds, dt = 1 / 60) => { for (let t = 0; t < seconds; t += dt) p.update(dt, t); };

/** A short raised strip 0.88 m wide (|x| < 0.44, floor 0.84) with a hall 2.3 m below on either side; a body of the visitor's size fits on the strip only within 0.22 of its middle; `blocked(x, z, r)` says where a body is. */
const strip = (blocked = () => false, zHalf = 0.25) => ({
  floorY: (x) => (Math.abs(x) < 0.44 ? 0.84 : -1.45), headroom: () => 2.6,
  free: (x, z, r) => !blocked(x, z, r) && ((Math.abs(x) <= 0.22 && Math.abs(z) <= zHalf) || Math.abs(x) >= 0.5),      // (a short strip, with ends; the hall below is free all round)
  passable: (x0, z0, x1, z1) => Math.abs(((Math.abs(x1) < 0.44) ? 0.84 : -1.45) - ((Math.abs(x0) < 0.44) ? 0.84 : -1.45)) <= 0.26,
});

test('a body at the visitor\'s side on a raised strip does not put them over the edge: they stay on the strip', () => {
  const body = { x: 0, z: 0.05, r: 0.2 };
  const world = strip((x, z, r) => Math.hypot(x - body.x, z - body.z) < r + body.r);
  const p = createPlayer(world, cam(), { x: 0, z: 0, yaw: 0 }, input());
  assert.equal(world.free(p.me.x, p.me.z, 0.22), false, 'the body is on top of them');
  run(p, 0.5);
  assert.ok(Math.abs(p.me.x) < 0.44, `still on the strip: x ${p.me.x.toFixed(2)}`);
  assert.equal(world.floorY(p.me.x, p.me.z), 0.84);
  body.x = 5;                                           // the body moves off: they are free where they are
  run(p, 0.2); assert.ok(Math.abs(p.me.x) < 0.44);
});

test('on a strip with a free spot on it, they are moved to that spot, not past it', () => {
  const body = { x: 0, z: 0.1, r: 0.2 };
  const world = strip((x, z, r) => Math.hypot(x - body.x, z - body.z) < r + body.r, 0.9);
  const p = createPlayer(world, cam(), { x: 0, z: 0, yaw: 0 }, input());
  run(p, 0.1);
  assert.ok(world.free(p.me.x, p.me.z, 0.22) && Math.abs(p.me.x) <= 0.22, `free, on the strip: (${p.me.x.toFixed(2)}, ${p.me.z.toFixed(2)})`);
});

test('shut in for good with no free spot on the floor, in the end any free spot will do (never a permanent trap)', () => {
  const world = { floorY: (x) => (x > 0.3 ? -1.45 : 0.84), headroom: () => 2.6, free: (x) => x > 0.3, passable: () => true };
  const p = createPlayer(world, cam(), { x: 0, z: 0, yaw: 0 }, input());
  run(p, 1); assert.ok(p.me.x < 0.3 + 1e-9 && !world.free(p.me.x, p.me.z, 0.22) || p.me.x <= 0, 'held on its own floor at first');
  run(p, 3.5); assert.ok(p.me.x > 0.3, `after being shut in for 3 s: out, x ${p.me.x.toFixed(2)}`);
});

test('a careful crawl (C held, stooped under something low) is under the quiet limit; the plain crawl is as fast as it was', () => {
  const low = { free: () => true, passable: () => true, floorY: () => 0, headroom: () => 0.95 };
  const creep = createPlayer(low, cam(), { x: 0, z: 0, yaw: 0 }, input(['w', 'c']));
  const plain = createPlayer(low, cam(), { x: 0, z: 0, yaw: 0 }, input(['w']));
  run(creep, 2); run(plain, 2);
  let worst = 0; const dt = 1 / 60;
  for (let t = 0; t < 4; t += dt) { creep.update(dt, t); worst = Math.max(worst, creep.me.speed); }
  assert.ok(worst < 0.92, `the careful crawl's fastest frame ${worst.toFixed(2)} m/s`);
  assert.ok(worst > 0.5, 'and it does move');
  assert.ok(CREEP < 0.92);
  run(plain, 1); assert.ok(plain.me.speed > 0.92, `the plain crawl is as fast as it was: ${plain.me.speed.toFixed(2)}`);
});

test('C held in the open is the crouch it always was (not capped to a creep)', () => {
  const open = { free: () => true, passable: () => true, floorY: () => 0, headroom: () => 2.6 };
  const p = createPlayer(open, cam(), { x: 0, z: 0, yaw: 0 }, input(['w', 'c']));
  run(p, 2); assert.ok(p.me.speed > 1.0, `crouching in the open: ${p.me.speed.toFixed(2)}`);
});
