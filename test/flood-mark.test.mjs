import test from 'node:test';
import assert from 'node:assert/strict';
import { FLOOD_PERIOD, FLOOD_HIGH, FLOOD_LOW, planFloodMark, floodFloor, floodPhase, floodRefuge, floodExposure } from '../public/world/backrooms/flood-mark-layout.js';

const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-7, `${a} != ${b}`);

test('flood cycle is continuous, bounded and repeats with a useful low-water crossing interval', () => {
  assert.equal(floodPhase(0).phase, 'high');
  close(floodPhase(0).water, FLOOD_HIGH);
  for (const t of [8, 16, 36, 44, 56]) close(floodPhase(t - 1e-7).water, floodPhase(t + 1e-7).water);
  for (let t = 0; t < FLOOD_PERIOD; t += .1) {
    const p = floodPhase(t);
    assert.ok(p.water >= FLOOD_LOW - 1e-7 && p.water <= FLOOD_HIGH + 1e-7);
    close(p.water, floodPhase(t + FLOOD_PERIOD).water);
  }
  for (let t = 16; t < 36; t += .5) { close(floodPhase(t).water, FLOOD_LOW); assert.equal(floodPhase(t).phase, 'low'); }
});

test('the whole stepped basin has no unwalkable floor jumps', () => {
  for (const [W, D] of [[14, 20], [17.8, 23.8], [20, 28]]) {
    const p = planFloodMark({ W, D });
    for (let j = 0; j < p.nz; j++) for (let i = 0; i < p.nx; i++) {
      const cell = p.cells[i + p.nx * j];
      close(floodFloor(p, (cell.x0 + cell.x1) / 2, (cell.z0 + cell.z1) / 2), cell.y);
      for (const [di, dj] of [[1, 0], [0, 1]]) if (i + di < p.nx && j + dj < p.nz) {
        assert.ok(Math.abs(cell.y - p.cells[i + di + p.nx * (j + dj)].y) <= .1800001);
      }
    }
  }
});

test('the zigzag path and every refuge remain connected at player width in all tide phases', () => {
  for (const [W, D] of [[14, 20], [17.8, 23.8], [20, 28]]) {
    const p = planFloodMark({ W, D });
    for (let n = 1; n < p.nodes.length; n++) {
      const a = p.nodes[n - 1], b = p.nodes[n], length = Math.hypot(b.x - a.x, b.z - a.z), steps = Math.ceil(length / .08);
      let before = floodFloor(p, a.x, a.z);
      for (let k = 0; k <= steps; k++) {
        const x = a.x + (b.x - a.x) * k / steps, z = a.z + (b.z - a.z) * k / steps, y = floodFloor(p, x, z);
        assert.ok(Math.abs(y - before) <= .1800001); before = y;
        for (const [dx, dz] of [[0, 0], [.225, 0], [-.225, 0], [0, .225], [0, -.225]]) {
          assert.ok(floodFloor(p, x + dx, z + dz) >= -.00001, 'a body fits on the raised path');
        }
        for (const t of [0, 12, 25, 40]) assert.equal(floodExposure(p, floodPhase(t), x, z).deep, false);
      }
    }
    for (const b of [...p.docks, ...p.islands]) {
      assert.equal(floodRefuge(p, b.x, b.z)?.id, b.id);
      assert.equal(floodExposure(p, floodPhase(0), b.x, b.z).wet, false, 'refuges stay dry at maximum water');
      assert.ok(p.nodes.some((a, i) => i && ((a.x === p.nodes[i - 1].x && Math.abs(b.x - a.x) < .01 && b.z >= Math.min(a.z, p.nodes[i - 1].z) && b.z <= Math.max(a.z, p.nodes[i - 1].z)) || (a.z === p.nodes[i - 1].z && Math.abs(b.z - a.z) < .01))), 'refuge lies on the path');
    }
  }
});

test('danger follows actual water depth: low tide exposes safe shallows, rising water makes them hazardous', () => {
  const p = planFloodMark(), island = p.islands[0];
  assert.equal(floodRefuge(p, island.x0 + .05, island.z), null);
  const deep = p.cells.find(b => b.y < -.8 && Math.abs((b.x0 + b.x1) / 2) < 5 && Math.abs((b.z0 + b.z1) / 2) < 8);
  const x = (deep.x0 + deep.x1) / 2, z = (deep.z0 + deep.z1) / 2;
  assert.equal(floodExposure(p, floodPhase(0), x, z).deep, true);
  assert.equal(floodExposure(p, floodPhase(25), x, z).deep, false);
  assert.ok(floodExposure(p, floodPhase(0), x, z).depth > floodExposure(p, floodPhase(25), x, z).depth);
  assert.equal(floodRefuge(p, x, z), null);
  for (const b of p.cells) {
    const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
    assert.equal(floodExposure(p, floodPhase(25), cx, cz).deep, false, 'every low-tide terrace is shallow enough to explore');
  }
  const floor = floodFloor(p, x, z);
  assert.equal(floodExposure(p, { water: floor + .649 }, x, z).deep, false);
  assert.equal(floodExposure(p, { water: floor + .651 }, x, z).deep, true);
});

test('plans serialize, preserve inputs, and reject unsupported room sizes', () => {
  const input = { W: 17.8, D: 23.8 }, before = structuredClone(input), p = planFloodMark(input);
  assert.deepEqual(input, before);
  assert.deepEqual(p, planFloodMark(input));
  assert.deepEqual(JSON.parse(JSON.stringify(p)), p);
  assert.throws(() => planFloodMark({ W: 13.9, D: 23.8 }), RangeError);
  assert.throws(() => planFloodMark({ W: NaN, D: 23.8 }), RangeError);
});
