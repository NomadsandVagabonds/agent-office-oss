import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from '../public/vendor/three.module.min.js';
import { Vox, M, glow, glass } from '../public/world/vox/vox.js';

// The browser resolves "three" through its import map. Resolve the same two
// dependencies to local file URLs for Node, while testing the production source.
const source = readFileSync(new URL('../public/world/vox/mesher.js', import.meta.url), 'utf8')
  .replace("from 'three'", `from '${new URL('../public/vendor/three.module.min.js', import.meta.url).href}'`)
  .replace("from './vox.js'", `from '${new URL('../public/world/vox/vox.js', import.meta.url).href}'`);
const { meshVox } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));

function sample() {
  return new Vox()
    .rbox(-7, 10, -6, 7, 24, 6, 4, M('#b88f72', 1))
    .rbox(-5, 0, -3, 5, 11, 3, 2, M('#3c4654', 2))
    .box(-5, 5, 3, 5, 7, 4, M('#433d34', 2))
    .box(-1, 5, 4, 1, 7, 5, M('#96998d', 0))
    .box(-5, 15, 5, -2, 18, 7, glass('#a9c6c8'))
    .box(2, 15, 5, 5, 18, 7, glow('#dcad63'));
}

function snapshot(g) {
  if (!g) return null;
  return {
    index: [...g.index.array],
    attributes: Object.fromEntries(Object.entries(g.attributes).map(([name, a]) => [name, [...a.array]])),
  };
}

// Rasterize triangles at unit-face centres. This compares the actual surface
// coverage and material channels regardless of how either mesh splits its quads.
function surfaces(g) {
  const result = new Map();
  if (!g) return result;
  const p = g.attributes.position, n = g.attributes.normal, ids = g.index.array;
  const point = i => [p.getX(i), p.getY(i), p.getZ(i)];
  for (let k = 0; k < ids.length; k += 3) {
    const a = point(ids[k]), b = point(ids[k + 1]), c = point(ids[k + 2]);
    const normal = [n.getX(ids[k]), n.getY(ids[k]), n.getZ(ids[k])];
    const d = normal.findIndex(v => v !== 0), u = (d + 1) % 3, w = (d + 2) % 3;
    const cross = (x, y, z) => (y[u] - x[u]) * (z[w] - x[w]) - (y[w] - x[w]) * (z[u] - x[u]);
    const direction = Math.sign(cross(a, b, c));
    const material = [g.attributes.aTex.getX(ids[k]), g.attributes.aEmis.getX(ids[k])];
    for (let x = Math.min(a[u], b[u], c[u]); x < Math.max(a[u], b[u], c[u]); x++) {
      for (let y = Math.min(a[w], b[w], c[w]); y < Math.max(a[w], b[w], c[w]); y++) {
        const q = [...a]; q[u] = x + .5; q[w] = y + .5;
        if ([cross(a, b, q), cross(b, c, q), cross(c, a, q)].some(v => v * direction < -1e-9)) continue;
        result.set([d, normal[d], a[d], x, y].join(','), material);
      }
    }
  }
  return result;
}

test('voxel mesher keeps the default AO output identical when explicitly enabled', () => {
  const v = sample(), implicit = meshVox(v), explicit = meshVox(v, { ao: true });
  assert.deepEqual(snapshot(implicit.solid), snapshot(explicit.solid));
  assert.deepEqual(snapshot(implicit.glass), snapshot(explicit.glass));
  assert.deepEqual(implicit.bounds, explicit.bounds);
});

test('disabling voxel AO reduces triangles while preserving surfaces, origins and material channels', () => {
  const v = sample(), before = [...v.map], origin = [2, -1, 3];
  const full = meshVox(v, { origin }), compact = meshVox(v, { origin, ao: false });
  assert.ok(compact.quads < full.quads * .7, 'rounded and restrained figures gain substantial coplanar merging');
  assert.deepEqual(compact.bounds, full.bounds);
  assert.deepEqual(surfaces(compact.solid), surfaces(full.solid));
  assert.deepEqual(surfaces(compact.glass), surfaces(full.glass));
  assert.deepEqual([...v.map], before, 'meshing never changes the source sculpture');
  const expected = ['#b88f72', '#3c4654', '#433d34', '#96998d', '#dcad63', '#a9c6c8']
    .map(hex => new THREE.Color(hex).toArray());
  for (const g of [compact.solid, compact.glass]) {
    const colors = g.attributes.color;
    for (let i = 0; i < colors.count; i++) {
      const rgb = [colors.getX(i), colors.getY(i), colors.getZ(i)];
      assert.ok(expected.some(c => c.every((x, k) => Math.abs(x - rgb[k]) < 1e-6)), 'base material colour survives without AO darkening');
    }
  }
});
