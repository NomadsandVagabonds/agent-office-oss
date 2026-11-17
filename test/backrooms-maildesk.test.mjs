import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MAILDESK, deskVox, breechVox } from '../public/world/backrooms/rooms/mailroom/desk.model.js';

const VOXEL = 0.025, near = (a, b) => Math.abs(a - b) < 1e-9;
const metres = (v, scale) => { const b = v.bounds(); return [(b.x1 - b.x0) * scale[0] * VOXEL, (b.y1 - b.y0) * scale[1] * VOXEL, (b.z1 - b.z0) * scale[2] * VOXEL]; };

test('the dispatch desk is the outer box of the three blocks it replaced, centred, on the floor', () => {
  const v = deskVox(), b = v.bounds(), m = metres(v, MAILDESK.desk.scale);
  // the blocks: x ±0.6, z ±0.48, 0 to 0.92
  assert.ok(near(m[0], 1.2) && near(m[1], 0.92) && near(m[2], 0.96), m.join(' × '));
  assert.equal(b.x0, -b.x1); assert.equal(b.z0, -b.z1); assert.equal(b.y0, 0);
});

test('its top is dead flat over the whole of it: canisters and the breech stand there', () => {
  const v = deskVox(), b = v.bounds(), top = b.y1 - 1;
  for (let x = b.x0; x < b.x1; x++) for (let z = b.z0; z < b.z1; z++) assert.ok(v.has(x, top, z), `a hole in the top at ${x}, ${z}`);
});

test('the face behind the dial is on its plane, and the frame round it clears the board', () => {
  const v = deskVox(), [sx, sy, sz] = MAILDESK.desk.scale.map((s) => s * VOXEL);
  // the room's board: 0.66 m by 0.29 m, its middle 0.52 m up, hung 0.446 m out from the desk's middle
  const x0 = Math.ceil(-0.33 / sx), x1 = Math.floor(0.33 / sx), y0 = Math.ceil(0.375 / sy), y1 = Math.floor(0.665 / sy);
  let face = -Infinity;
  for (let x = x0; x < x1; x++) for (let y = y0; y < y1; y++) { let z = 40; while (z > 0 && !v.has(x, y, z)) z--; face = Math.max(face, (z + 1) * sz); }
  assert.ok(face <= 0.446 && face >= 0.43, `the face behind the board is at ${face.toFixed(4)} m`);
});

test('the breech is the two blocks it replaced, and its throat is down the middle', () => {
  const v = breechVox(), b = v.bounds(), m = metres(v, MAILDESK.breech.scale);
  assert.ok(near(m[0], 0.26) && near(m[1], 0.15) && near(m[2], 0.26), m.join(' × '));
  assert.equal(b.x0, -b.x1); assert.equal(b.z0, -b.z1);
  assert.equal(v.has(0, b.y1 - 1, 0), false, 'open at the top, in the middle');
  assert.equal(v.has(-1, b.y1 - 1, -1), false);
});

test('the room still keeps its own solid, shadow, reserve and dial, at the numbers they had', () => {
  const src = readFileSync(new URL('../public/world/backrooms/rooms/mailroom.js', import.meta.url), 'utf8');
  for (const line of ['c.reserve(mx, mz, 1.15);', 'c.solid(mx - 0.58, mz - 0.46, mx + 0.58, mz + 0.46, { tall: false });', 'c.shadow(mx, mz, 1.2, 0.96, 0.5);', "c.board(c.mapped('dial', dial), mx, 0.52, mz + 0.446, 0.66, 0.29, 0);"]) assert.ok(src.includes(line), line);
});
