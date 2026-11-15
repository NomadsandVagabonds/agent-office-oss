// The last three seconds of a visit that ends by being caught are on the building's own camera (lastshot.js): where it
// hangs, and that the conductor hands the picture to whoever took the visitor and to nobody else.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SHOT, cameraFor, cameraFrom, slumps } from '../public/world/backrooms/lastshot.js';

const read = (f) => readFileSync(new URL(`../public/world/backrooms/${f}`, import.meta.url), 'utf8');
const room = { x0: 0, z0: 0, x1: 8, z1: 6, y: 0, H: 2.6 };

test('the building\'s camera hangs in a corner that can see the visitor, looks at them, and is never outside the room', () => {
  const spot = { x: 2, y: 0, z: 2, yaw: 0 };
  const cam = cameraFor(room, spot);
  assert.deepEqual([cam.x, cam.z], [8 - SHOT.inset, 6 - SHOT.inset], 'the furthest corner');
  assert.ok(cam.y > 2 && cam.y < room.H, 'under the ceiling');
  assert.ok(cam.pitch < 0, 'looking down');
  // it is looking at them: a pace along the way it faces is nearer the spot (yaw 0 looks toward -z)
  const fx = -Math.sin(cam.yaw), fz = -Math.cos(cam.yaw);
  assert.ok(Math.hypot(cam.x + fx - spot.x, cam.z + fz - spot.z) < Math.hypot(cam.x - spot.x, cam.z - spot.z) - 0.99);
  // a corner with something in the way is not the one
  const blocked = cameraFor(room, spot, (x, z) => !(x > 4 && z > 3));
  assert.ok(!(blocked.x > 4 && blocked.z > 3));
  // a corner too near to show anything but the top of a head is not the one either
  const near = cameraFor(room, { x: 7.4, y: 0, z: 5.4, yaw: 0 });
  assert.ok(Math.hypot(near.x - 7.4, near.z - 5.4) >= SHOT.least);
  // a low room: still inside it
  assert.ok(cameraFor({ ...room, H: 0.95 }, spot).y < 0.95);
  // no room (a doorway), or nothing sees: over their shoulder, and never exactly on top of them
  const none = cameraFor(null, { x: 1, y: 0, z: 1, yaw: 0 });
  assert.ok(none.z > 1 && Math.abs(none.x - 1) < 1e-9 && none.y > 1.5, 'behind somebody who faces -z is +z');
  const blind = cameraFor(room, spot, () => false);
  assert.ok(Number.isFinite(blind.yaw) && Number.isFinite(blind.pitch) && blind.y < room.H);
});

test('left to itself the character goes down where it stood; and only being caught is shown this way', () => {
  assert.equal(slumps(0), 0); assert.equal(slumps(0.5), 0); assert.equal(slumps(SHOT.seconds), 1);
  assert.ok(slumps(0.9) > 0 && slumps(0.9) < 1);
  const src = read('index.js');
  assert.match(src, /if \(why === 'caught' && !\(shot = beginShot\(\)\)\) sound\.play\('static'/, 'a flat battery, giving up and the way out end as they did');
  assert.match(src, /&& !shot && !shotCam\) \{ env\.pursuer\?\.update/, 'nobody of the cast is run once the building has the picture');
  assert.match(src, /const told = \{ \.\.\.spot, room: rt\?\.id \?\? null, figure: figure\.root, seconds: SHOT\.seconds, from: null \};\n      try \{ run = taker\?\.it\?\.takes\?\.\(told\)/);
  // whoever took them may say where to film from, and the camera then looks at the spot from there
  const seat = cameraFrom({ x: 3, y: 2, z: 5 }, { x: 3, y: 0, z: 1 });
  assert.ok(Math.abs(seat.yaw) < 1e-9 && seat.pitch < 0 && seat.z === 5, 'from +z, looking toward -z and down');
  assert.match(src, /seen = cameraFrom\(told\.from, spot\) \?\? seen;/);
  // who took them is noted before the hit is made (the visit begins to end inside it), and forgotten if they lived
  const cast = read('pursuer.js');
  assert.match(cast, /const before = taker; taker = k;\n      const hit = env\.health\?\.damage\(creatureTuning\(env\.difficulty\?\.\(\) \?\? 'training-wheels', member\.id\)\.damage \?\? n\);/);
  assert.match(cast, /const ended = !!hit\.dead && !options\.hasSurvivor\?\.\(\);\n        if \(!ended\) taker = before;/);
});

test('a taker may say where it is filmed from, and what is looked at', () => {
  const spot = { x: 2, y: 0, z: 2, yaw: 0 };
  const cam = cameraFrom({ x: 2, y: 2, z: 6 }, spot);
  assert.ok(Math.abs(cam.yaw) < 1e-9, 'it looks toward -z, at the visitor');
  assert.ok(cam.pitch < 0, 'and down');
  const aimed = cameraFrom({ x: 2, y: 1, z: 6, at: { x: 6, y: 1, z: 6 } }, spot);
  assert.ok(Math.abs(aimed.yaw + Math.PI / 2) < 1e-9 && Math.abs(aimed.pitch) < 1e-9, 'at what it was told to look at');
  assert.equal(cameraFrom(null, spot), null);
  assert.equal(cameraFrom({ x: NaN, y: 1, z: 1 }, spot), null);
  assert.equal(cameraFrom({ x: 2, y: 2.5, z: 2.1 }, spot), null, 'not from on top of it');
});
