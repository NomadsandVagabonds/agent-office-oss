import test from 'node:test';
import assert from 'node:assert/strict';
import { freightLayout, freightStash } from '../public/world/backrooms/freight-layout.js';

// Independent body-sized flood through the authored solids. Unlike the
// engine's multi-door fallback, this also checks our single-entry room.
function floor(room, layout) {
  const r = 0.25, step = 0.125, nx = Math.ceil(room.W / step), nz = Math.ceil(room.D / step);
  const free = (x, z) => {
    if (Math.abs(x) > room.W / 2 - r || Math.abs(z) > room.D / 2 - r) return false;
    return layout.solids.every((b) => {
      const dx = x - Math.max(b.x0, Math.min(x, b.x1)), dz = z - Math.max(b.z0, Math.min(z, b.z1));
      return dx * dx + dz * dz >= r * r;
    });
  };
  const key = ({ x, z }) => Math.floor((x + room.W / 2) / step) + nx * Math.floor((z + room.D / 2) / step);
  const seen = new Uint8Array(nx * nz), queue = [key(layout.entry)];
  seen[queue[0]] = 1;
  for (let at = 0; at < queue.length; at++) {
    const k = queue[at], i = k % nx, j = Math.floor(k / nx);
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ii = i + di, jj = j + dj, kk = ii + jj * nx;
      if (ii < 0 || jj < 0 || ii >= nx || jj >= nz || seen[kk]) continue;
      if (!free(-room.W / 2 + (ii + 0.5) * step, -room.D / 2 + (jj + 0.5) * step)) continue;
      seen[kk] = 1; queue.push(kk);
    }
  }
  return { free, reaches: (p) => free(p.x, p.z) && seen[key(p)] === 1 };
}

test('freight keeps its work floor, hidden crate and loot reachable across sizes and seeds', () => {
  for (const W of [17.8, 19.8, 21.8]) for (const D of [21.8, 23.8, 25.8]) for (let seed = 1; seed <= 12; seed++) {
    const room = { W, D, H: seed % 2 ? 5 : 6, params: { layoutSeed: seed * 7919 } }, layout = freightLayout(room), walk = floor(room, layout);
    const { work, portal } = layout, [x0, z0, x1, z1] = freightStash(room);
    const targets = { home: work.home, pickup: work.pickup, loading: work.loading, crateEntry: portal.entry, crateInterior: { x: portal.x, z: portal.z }, coin: { x: (x0 + x1) / 2, z: (z0 + z1) / 2 } };
    for (const [name, p] of Object.entries(targets)) assert.ok(walk.reaches(p), `${W}×${D} seed ${seed}: ${name} is reachable with radius .25`);
    for (const p of [work.home, work.pickup, work.loading]) for (const dx of [-0.46, 0.46]) assert.ok(walk.reaches({ x: p.x + dx, z: p.z }), `space for both workers at ${JSON.stringify(p)}`);
    const heap = work.hoard, box = work.crate;
    assert.ok(heap.x0 > -W / 2 && heap.x1 < W / 2 && heap.z0 > -D / 2 && heap.z1 < D / 2 && heap.h < room.H,
      'the GPU hoard fits inside the room and below the ceiling');
    assert.ok(heap.x1 < box.x - box.w / 2, 'the hoard leaves the open loading crate unobstructed');
    for (const c of layout.crates) assert.ok(c.x1 <= heap.x0 || c.x0 >= heap.x1 || c.z1 <= heap.z0 || c.z0 >= heap.z1,
      'maze freight does not occupy the GPU hoard');
    assert.ok(layout.crates.length >= 25, 'the maze remains substantial');
    for (const c of layout.crates) assert.ok(c.x0 > -W / 2 && c.x1 < W / 2 && c.z0 > -D / 2 && c.z1 < D / 2, 'freight stays within the room');
    assert.equal(walk.free(portal.x, portal.outer.z1), false, 'front face is closed');
    assert.equal(walk.free(portal.outer.x0, portal.z), false, 'left face is closed');
    assert.equal(walk.free(portal.outer.x1, portal.z), false, 'right face is closed');
    assert.equal(walk.free(portal.x, portal.outer.z0), true, 'only the back face is open');
  }
});

test('the layout is deterministic and changes with its rolled seed', () => {
  const room = { W: 19.8, D: 23.8, H: 5.5, params: { layoutSeed: 713 } };
  assert.deepEqual(freightLayout(room), freightLayout(room));
  assert.notDeepEqual(freightLayout(room).open, freightLayout(room, 714).open);
});
