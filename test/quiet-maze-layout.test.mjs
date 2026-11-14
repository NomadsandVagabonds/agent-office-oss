import test from 'node:test';
import assert from 'node:assert/strict';
import { quietMazeLayout } from '../public/world/backrooms/quiet-maze-layout.js';

const RADIUS = 0.22, CELL = 0.1, EPS = 1e-8;
const bounds = p => ({ x0: p.x - p.w / 2, x1: p.x + p.w / 2, z0: p.z - p.d / 2, z1: p.z + p.d / 2 });

// Independent circle/rectangle collision and flood, including midpoint checks
// on grid edges. Count every free cell, not just the selected target probes:
// a closed pocket could otherwise pass all doorway-to-doorway assertions.
function floor(W, D, pillars) {
  const boxes = pillars.map(bounds), nx = Math.ceil(W / CELL), nz = Math.ceil(D / CELL);
  const free = (x, z) => {
    if (Math.abs(x) > W / 2 - RADIUS || Math.abs(z) > D / 2 - RADIUS) return false;
    return boxes.every(b => {
      const dx = x - Math.max(b.x0, Math.min(x, b.x1));
      const dz = z - Math.max(b.z0, Math.min(z, b.z1));
      return dx * dx + dz * dz >= RADIUS * RADIUS - EPS;
    });
  };
  const at = k => ({ x: -W / 2 + (k % nx + 0.5) * CELL, z: -D / 2 + (Math.floor(k / nx) + 0.5) * CELL });
  const key = ({ x, z }) => Math.floor((x + W / 2) / CELL) + nx * Math.floor((z + D / 2) / CELL);
  const open = new Uint8Array(nx * nz), seen = new Uint8Array(nx * nz);
  let freeCount = 0, start = -1;
  for (let k = 0; k < open.length; k++) {
    const p = at(k);
    if (free(p.x, p.z)) { open[k] = 1; freeCount++; if (start < 0) start = k; }
  }
  const queue = [start]; seen[start] = 1;
  for (let head = 0; head < queue.length; head++) {
    const k = queue[head], i = k % nx, j = Math.floor(k / nx), p = at(k);
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ii = i + di, jj = j + dj, n = ii + jj * nx;
      if (ii < 0 || ii >= nx || jj < 0 || jj >= nz || !open[n] || seen[n]) continue;
      const q = at(n);
      if (!free((p.x + q.x) / 2, (p.z + q.z) / 2)) continue;
      seen[n] = 1; queue.push(n);
    }
  }
  return { free, freeCount, reachedCount: queue.length, reaches: p => free(p.x, p.z) && seen[key(p)] === 1 };
}

test('every quiet-maze free area, probe and doorway approach stays connected', () => {
  for (const W of [9.8, 10.8, 11.8, 12.8, 13.8]) for (const D of [9.8, 10.8, 11.8, 12.8, 13.8]) {
    for (let variant = 0; variant < 3; variant++) for (let turn = 0; turn < 4; turn++) {
      const label = `${W}×${D}, variant ${variant}, turn ${turn}`;
      const layout = quietMazeLayout({ W, D, variant, turn }), walk = floor(W, D, layout.pillars);
      assert.ok(walk.freeCount > 0, label);
      assert.equal(walk.reachedCount, walk.freeCount, `${label}: no isolated walkable pockets`);
      for (const p of layout.probes) assert.ok(walk.reaches(p), `${label}: probe ${JSON.stringify(p)}`);
      // A 1.8 m doorway at 0 or either ±2.4 m offset. Sample where the
      // player's center can enter, from the wall to 1.25 m into the room.
      for (const offset of [-2.4, 0, 2.4]) for (const across of [-0.6, 0, 0.6]) for (const inset of [0.3, 0.6, 0.9, 1.25]) {
        for (const p of [
          { x: offset + across, z: -D / 2 + inset }, { x: offset + across, z: D / 2 - inset },
          { x: -W / 2 + inset, z: offset + across }, { x: W / 2 - inset, z: offset + across },
        ]) assert.ok(walk.reaches(p), `${label}: doorway approach ${JSON.stringify(p)}`);
      }
    }
  }
});

test('partitions preserve the outer loop and have no narrow accidental gaps', () => {
  for (const [W, D] of [[9.8, 9.8], [9.8, 13.8], [11.8, 11.8], [13.8, 9.8], [13.8, 13.8]]) {
    for (let variant = 0; variant < 3; variant++) for (let turn = 0; turn < 4; turn++) {
      const boxes = quietMazeLayout({ W, D, variant, turn }).pillars.map(bounds);
      let smallestGap = Infinity;
      for (const b of boxes) {
        assert.ok(b.x0 >= -W / 2 + 1.5 - EPS && b.x1 <= W / 2 - 1.5 + EPS);
        assert.ok(b.z0 >= -D / 2 + 1.5 - EPS && b.z1 <= D / 2 - 1.5 + EPS);
      }
      for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i], b = boxes[j];
        const dx = Math.max(0, a.x0 - b.x1, b.x0 - a.x1), dz = Math.max(0, a.z0 - b.z1, b.z0 - a.z1);
        const gap = Math.hypot(dx, dz);
        if (gap <= EPS) continue; // Deliberately joined elbows are solid, not passages.
        assert.ok(gap >= 1.4 - EPS, `unexpected ${gap} m slit`);
        smallestGap = Math.min(smallestGap, gap);
      }
      assert.ok(smallestGap <= 1.8 + EPS, 'the family retains its shared narrow interior aisle');
    }
  }
});

test('the small layout family repeats without random decoration', () => {
  const args = { W: 11.8, D: 11.8, variant: 1, turn: 3 };
  assert.deepEqual(quietMazeLayout(args), quietMazeLayout(args));
  assert.deepEqual(quietMazeLayout(args), quietMazeLayout({ ...args, variant: 4, turn: 7 }));
  for (let turn = 0; turn < 4; turn++) {
    const layout = quietMazeLayout({ ...args, turn });
    assert.deepEqual(JSON.parse(JSON.stringify(layout)), layout);
  }
  assert.throws(() => quietMazeLayout({ W: 9, D: 11.8 }), RangeError);
  assert.throws(() => quietMazeLayout({ W: 11.8, D: NaN }), RangeError);
});
