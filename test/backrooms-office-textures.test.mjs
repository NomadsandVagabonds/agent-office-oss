import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { register } from 'node:module';

const pub = new URL('../public/', import.meta.url).href;
register('data:text/javascript,' + encodeURIComponent(`export function resolve(s,c,next) {
  if (s === 'three') return {url:${JSON.stringify(pub + 'vendor/three.module.min.js')},shortCircuit:true};
  if (s.startsWith('/vendor/')) return {url:${JSON.stringify(pub.slice(0, -1))}+s,shortCircuit:true};
  return next(s,c);
}`), import.meta.url);

const THREE = await import('three');
const {
  OFFICE_PAPER_PATTERNS,
  STAIN_UVS,
  makeWallpaperTexture,
  makeCarpetTexture,
  makeCeilingTexture,
  makeWaterCeilingTileTexture,
  makeSkirtingTexture,
  makeStainAtlasTexture,
  makePeelTexture,
  makePuddleMaskTexture,
} = await import('../public/world/backrooms/office-textures.js');

/** Lightweight recording 2D canvas mock for Node tests. */
function withMockCanvas(fn) {
  const prevDoc = globalThis.document;
  const canvases = [];
  globalThis.document = {
    createElement(tag) {
      assert.equal(tag, 'canvas', 'office-textures should only create canvas elements');
      const ops = [];
      const ctx = {
        fillStyle: '#000000',
        strokeStyle: '#000000',
        lineWidth: 1,
        imageSmoothingEnabled: true,
        clearRect(x, y, w, h) {
          ops.push({ op: 'clearRect', x, y, w, h });
        },
        fillRect(x, y, w, h) {
          ops.push({ op: 'fillRect', style: this.fillStyle, x, y, w, h });
        },
      };
      const canvas = {
        width: 0,
        height: 0,
        ops,
        ctx,
        getContext(kind) {
          assert.equal(kind, '2d');
          return ctx;
        },
      };
      canvases.push(canvas);
      return canvas;
    },
  };
  try {
    return fn(canvases);
  } finally {
    if (prevDoc === undefined) delete globalThis.document;
    else globalThis.document = prevDoc;
  }
}

const SAMPLE_LOOK = Object.freeze({
  family: 'yellow',
  pattern: 'chevron',
  wall: '#d5c879',
  ink: '#aa9b4e',
  pale: '#e5db9c',
  carpet: '#80765b',
  trim: '#694a2b',
  ceil: '#d6d2c4',
});

function assertTextureMeta(tex, { w, h, wrapS, wrapT, minFilter = THREE.LinearMipmapLinearFilter }) {
  assert.ok(tex instanceof THREE.CanvasTexture, 'returns THREE.CanvasTexture');
  assert.equal(tex.image.width, w, `canvas width is ${w}`);
  assert.equal(tex.image.height, h, `canvas height is ${h}`);
  assert.equal(tex.wrapS, wrapS, 'wrapS matches');
  assert.equal(tex.wrapT, wrapT, 'wrapT matches');
  assert.equal(tex.magFilter, THREE.LinearFilter, 'magFilter is LinearFilter (WebGPU anisotropy requirement)');
  assert.equal(tex.minFilter, minFilter, 'minFilter is LinearMipmapLinearFilter');
  assert.equal(tex.anisotropy, 8, 'anisotropy is 8');
  assert.equal(tex.colorSpace, THREE.SRGBColorSpace, 'colorSpace is SRGBColorSpace');
  assert.equal(tex.image.ctx.imageSmoothingEnabled, false, 'canvas disables smoothing for crisp voxel grid');
  assert.ok(tex.image.ops.length > 0, 'drew operations onto canvas');
}

test('office-textures.js never statically imports three.webgpu and avoids Math.random', () => {
  const src = fs.readFileSync(new URL('../public/world/backrooms/office-textures.js', import.meta.url), 'utf8');
  assert.ok(!src.includes('three.webgpu'), 'must never import three.webgpu');
  assert.ok(!src.includes('Math.random'), 'must remain 100% deterministic without Math.random');
});

test('OFFICE_PAPER_PATTERNS identifies office paper motifs and excludes non-paper walls', () => {
  for (const p of ['chevron', 'chevrons', 'dots', 'diamonds', 'stripes', 'trellis', 'sprigs', undefined, null, '']) {
    assert.equal(OFFICE_PAPER_PATTERNS.has(p), true, `should include ${String(p)}`);
  }
  for (const nonPaper of ['blocks', 'board', 'panel', 'mall', 'sky', 'tiles', 'boughs']) {
    assert.equal(OFFICE_PAPER_PATTERNS.has(nonPaper), false, `should exclude ${nonPaper}`);
  }
});

test('every texture generator returns a CanvasTexture with expected dimensions, wrapping, filters and anisotropy', () => {
  withMockCanvas(() => {
    const wp = makeWallpaperTexture(SAMPLE_LOOK);
    assertTextureMeta(wp, { w: 256, h: 256, wrapS: THREE.RepeatWrapping, wrapT: THREE.RepeatWrapping });

    const cp = makeCarpetTexture(SAMPLE_LOOK.carpet);
    assertTextureMeta(cp, { w: 256, h: 256, wrapS: THREE.RepeatWrapping, wrapT: THREE.RepeatWrapping });

    const cl = makeCeilingTexture(SAMPLE_LOOK.ceil);
    assertTextureMeta(cl, { w: 128, h: 128, wrapS: THREE.RepeatWrapping, wrapT: THREE.RepeatWrapping });

    const wc = makeWaterCeilingTileTexture(SAMPLE_LOOK.ceil);
    assertTextureMeta(wc, { w: 128, h: 128, wrapS: THREE.ClampToEdgeWrapping, wrapT: THREE.ClampToEdgeWrapping });
    assert.ok(wc.image.ops.length > cl.image.ops.length, 'water-damaged ceiling tile adds tide-ring fills over base tile');

    const sk = makeSkirtingTexture(SAMPLE_LOOK.trim);
    assertTextureMeta(sk, { w: 128, h: 32, wrapS: THREE.RepeatWrapping, wrapT: THREE.ClampToEdgeWrapping });

    const st = makeStainAtlasTexture();
    assertTextureMeta(st, { w: 256, h: 256, wrapS: THREE.ClampToEdgeWrapping, wrapT: THREE.ClampToEdgeWrapping });
    assert.equal(st.image.ops[0].op, 'clearRect', 'stain atlas starts transparent');

    const pl = makePeelTexture(SAMPLE_LOOK);
    assertTextureMeta(pl, { w: 64, h: 128, wrapS: THREE.ClampToEdgeWrapping, wrapT: THREE.ClampToEdgeWrapping });
    assert.equal(pl.image.ops[0].op, 'clearRect', 'peel decal starts transparent');

    const pd = makePuddleMaskTexture();
    assertTextureMeta(pd, { w: 128, h: 128, wrapS: THREE.ClampToEdgeWrapping, wrapT: THREE.ClampToEdgeWrapping });
    assert.equal(pd.image.ops[0].op, 'clearRect', 'puddle mask starts transparent');
  });
});

test('all wallpaper patterns render cleanly, stay within canvas bounds, and produce distinct motifs', () => {
  const patterns = ['chevron', 'dots', 'diamonds', 'stripes', 'trellis', 'sprigs'];
  const serialized = new Map();

  withMockCanvas(() => {
    for (const pattern of [...patterns, 'chevrons', undefined, null, '']) {
      const tex = makeWallpaperTexture({ ...SAMPLE_LOOK, pattern });
      assertTextureMeta(tex, { w: 256, h: 256, wrapS: THREE.RepeatWrapping, wrapT: THREE.RepeatWrapping });
      const fills = tex.image.ops.filter((o) => o.op === 'fillRect');
      assert.ok(fills.length > 50, `pattern ${String(pattern)} draws rich detail`);
      for (const f of fills) {
        assert.ok(f.x >= 0 && f.y >= 0 && f.x + f.w <= 256 && f.y + f.h <= 256,
          `fillRect in bounds for ${String(pattern)}: ${JSON.stringify(f)}`);
      }
      // Verify vertical strip seam exists along x = 0..4
      assert.ok(fills.some((f) => f.x === 0 && f.h === 256 && f.w <= 4), `seam shadow drawn on x=0 for ${String(pattern)}`);
      assert.ok(fills.some((f) => f.x === 4 && f.h === 256 && f.w === 4), `pale overlap edge drawn on x=4 for ${String(pattern)}`);
      if (patterns.includes(pattern)) serialized.set(pattern, JSON.stringify(tex.image.ops));
    }
  });

  assert.equal(new Set(serialized.values()).size, patterns.length, 'each of the 6 wallpaper patterns renders distinctly');
});

test('STAIN_UVS has 4 frozen, non-overlapping UV quads inside [0, 1] matching the 2×2 atlas cells', () => {
  assert.ok(Object.isFrozen(STAIN_UVS), 'STAIN_UVS is frozen');
  assert.equal(STAIN_UVS.length, 4);

  const rects = STAIN_UVS.map((quad, idx) => {
    assert.ok(Object.isFrozen(quad), `quad ${idx} is frozen`);
    assert.equal(quad.length, 4, `quad ${idx} has 4 corners`);
    const [[u0, v0], [u1, v0b], [u1b, v1], [u0b, v1b]] = quad;
    assert.equal(v0, v0b, `quad ${idx} bottom edge aligned`);
    assert.equal(u1, u1b, `quad ${idx} right edge aligned`);
    assert.equal(v1, v1b, `quad ${idx} top edge aligned`);
    assert.equal(u0, u0b, `quad ${idx} left edge aligned`);
    assert.ok(u0 >= 0 && u0 < u1 && u1 <= 1, `quad ${idx} u in [0,1]`);
    assert.ok(v0 >= 0 && v0 < v1 && v1 <= 1, `quad ${idx} v in [0,1]`);
    return { u0, v0, u1, v1 };
  });

  // Check pairwise non-overlap and full unit-square coverage
  let totalArea = 0;
  for (let i = 0; i < rects.length; i++) {
    const a = rects[i];
    totalArea += (a.u1 - a.u0) * (a.v1 - a.v0);
    for (let j = i + 1; j < rects.length; j++) {
      const b = rects[j];
      const overlapU = Math.min(a.u1, b.u1) - Math.max(a.u0, b.u0);
      const overlapV = Math.min(a.v1, b.v1) - Math.max(a.v0, b.v0);
      assert.ok(overlapU <= 0 || overlapV <= 0, `quads ${i} and ${j} do not overlap`);
    }
  }
  assert.equal(totalArea, 1, '4 quads partition [0,1]×[0,1]');

  // Verify stain atlas draws inside all 4 cells with clean transparent gutters (prevents LinearFilter bleed)
  withMockCanvas(() => {
    const atlas = makeStainAtlasTexture();
    const fills = atlas.image.ops.filter((o) => o.op === 'fillRect');
    const counts = [0, 0, 0, 0];
    for (const f of fills) {
      const cellX = f.x < 128 ? 0 : 1;
      const cellY = f.y < 128 ? 0 : 1;
      const idx = cellY * 2 + cellX;
      const lx = f.x - cellX * 128;
      const ly = f.y - cellY * 128;
      assert.ok(lx >= 8 && lx + f.w <= 120 && ly >= 8 && ly + f.h <= 120,
        `cell ${idx} keeps 8px transparent margin to prevent LinearFilter bleed: ${JSON.stringify(f)}`);
      counts[idx]++;
    }
    for (let i = 0; i < 4; i++) assert.ok(counts[i] > 20, `stain atlas cell ${i} has substantial voxel detail`);
  });
});

test('determinism: calling every generator twice with identical inputs produces identical draw calls', () => {
  const cases = [
    ['wallpaper:chevron', () => makeWallpaperTexture({ ...SAMPLE_LOOK, pattern: 'chevron' })],
    ['wallpaper:dots', () => makeWallpaperTexture({ ...SAMPLE_LOOK, pattern: 'dots' })],
    ['wallpaper:diamonds', () => makeWallpaperTexture({ ...SAMPLE_LOOK, pattern: 'diamonds' })],
    ['wallpaper:stripes', () => makeWallpaperTexture({ ...SAMPLE_LOOK, pattern: 'stripes' })],
    ['wallpaper:trellis', () => makeWallpaperTexture({ ...SAMPLE_LOOK, pattern: 'trellis' })],
    ['wallpaper:sprigs', () => makeWallpaperTexture({ ...SAMPLE_LOOK, pattern: 'sprigs' })],
    ['carpet', () => makeCarpetTexture(SAMPLE_LOOK.carpet)],
    ['ceiling', () => makeCeilingTexture(SAMPLE_LOOK.ceil)],
    ['waterCeilingTile', () => makeWaterCeilingTileTexture(SAMPLE_LOOK.ceil)],
    ['skirting', () => makeSkirtingTexture(SAMPLE_LOOK.trim)],
    ['stainAtlas', () => makeStainAtlasTexture()],
    ['peel', () => makePeelTexture(SAMPLE_LOOK)],
    ['puddleMask', () => makePuddleMaskTexture()],
  ];

  withMockCanvas(() => {
    for (const [name, build] of cases) {
      const a = build();
      const b = build();
      assert.deepEqual(a.image.ops, b.image.ops, `${name} is 100% deterministic`);
    }
  });
});
