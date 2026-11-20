import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SHADOWS,
  SMOOTH_SHADOW_PASSES,
  mapLayout,
  gutter,
  blurLightmap,
  layoutUniforms,
} from '../public/world/backrooms/shadowmap.js';
import {
  LIGHTING,
  LIGHTING_MODES,
  planLighting,
  panelBank,
  bankLevels,
  localLightScale,
} from '../public/world/backrooms/lighting.js';
import {
  YELLOW_LIGHTING_MIX,
  planOfficeLighting,
  planFloorOfficeLighting,
  ballastTint,
  deadStarterGlow,
} from '../public/world/backrooms/office-lighting.js';
import { generate } from '../public/world/backrooms/gen.js';

const luma = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

/* ---- blurLightmap & smooth shadows ------------------------------------------------------------ */

test('SMOOTH_SHADOW_PASSES exports frozen pass counts for tubes (1) and doors (2)', () => {
  assert.equal(SMOOTH_SHADOW_PASSES.tubes, 1);
  assert.equal(SMOOTH_SHADOW_PASSES.doors, 2);
  assert.ok(Object.isFrozen(SMOOTH_SHADOW_PASSES));
});

test('blurLightmap softens a hard step edge inside a region, is pure by default, and supports 1..4 channels', () => {
  const layout = mapLayout({ W: 1, D: 1, H: 1, floor: true, walls: new Set() });
  const fl = layout.regions.floor;
  assert.ok(fl.nu >= 8 && fl.nv >= 8);

  for (const ch of [1, 2, 3, 4]) {
    const src = new Uint8Array(layout.width * layout.height * ch);
    const mid = Math.floor(fl.nu / 2);
    // Hard vertical step inside the floor region: left half 0, right half 255.
    for (let j = 0; j < fl.nv; j++) {
      for (let i = 0; i < fl.nu; i++) {
        const val = i < mid ? 0 : 255;
        const off = ((fl.py + j) * layout.width + fl.px + i) * ch;
        for (let c = 0; c < ch; c++) src[off + c] = val;
      }
    }
    gutter(layout, src, ch);
    const before = new Uint8Array(src);

    const pass1 = blurLightmap(src, layout, ch, 1);
    assert.notEqual(pass1, src, 'pure by default: returns a fresh Uint8Array');
    assert.deepEqual(src, before, 'input buffer is not mutated');

    const at = (buf, i, j, c = 0) => buf[((fl.py + j) * layout.width + fl.px + i) * ch + c];
    const row = Math.floor(fl.nv / 2);
    // Exact separable [1,2,1]/4 horizontal ramp across the step (vertical is uniform so unchanged).
    assert.equal(at(pass1, mid - 2, row), 0);
    assert.equal(at(pass1, mid - 1, row), 64);
    assert.equal(at(pass1, mid, row), 191);
    assert.equal(at(pass1, mid + 1, row), 255);
    for (let c = 0; c < ch; c++) {
      assert.equal(at(pass1, mid - 1, row, c), 64);
      assert.equal(at(pass1, mid, row, c), 191);
    }

    // Second pass softens further and widens the penumbra monotonically.
    const pass2 = blurLightmap(src, layout, ch, 2);
    assert.ok(at(pass2, mid - 2, row) > 0 && at(pass2, mid - 2, row) < at(pass2, mid - 1, row));
    assert.ok(at(pass2, mid - 1, row) > 64 && at(pass2, mid - 1, row) < at(pass2, mid, row));
    assert.ok(at(pass2, mid, row) < 191 && at(pass2, mid + 1, row) < 255);

    // inPlace option mutates in place and matches pure output byte-for-byte.
    const copy = new Uint8Array(src);
    const same = blurLightmap(copy, layout, ch, 2, { inPlace: true });
    assert.equal(same, copy);
    assert.deepEqual(copy, pass2);
  }
});

test('blurLightmap NEVER bleeds across region boundaries and refreshes the 1-texel gutter', () => {
  const layout = mapLayout({ W: 2, D: 2, H: 1, floor: true, walls: new Set(['back', 'front', 'left', 'right']) });
  const ch = 4;
  const src = new Uint8Array(layout.width * layout.height * ch);
  // Assign distinct constant values per region so any cross-region bleed is immediately detectable.
  const fills = {
    floor: [255, 240, 220, 200],
    back: [0, 10, 20, 30],
    front: [200, 150, 100, 50],
    left: [12, 34, 56, 78],
    right: [250, 180, 90, 40],
  };
  for (const r of layout.list) {
    const col = fills[r.name];
    for (let j = 0; j < r.nv; j++) {
      for (let i = 0; i < r.nu; i++) {
        const off = ((r.py + j) * layout.width + r.px + i) * ch;
        for (let c = 0; c < ch; c++) src[off + c] = col[c];
      }
    }
  }
  // Poison every gutter texel with a sentinel value BEFORE blurring to verify refresh.
  for (const r of layout.list) {
    for (let j = -1; j <= r.nv; j++) {
      for (let i = -1; i <= r.nu; i++) {
        if (i >= 0 && j >= 0 && i < r.nu && j < r.nv) continue;
        const off = ((r.py + j) * layout.width + r.px + i) * ch;
        for (let c = 0; c < ch; c++) src[off + c] = 123;
      }
    }
  }

  const out = blurLightmap(src, layout, ch, 4);
  for (const r of layout.list) {
    const col = fills[r.name];
    // Interior must stay 100% pure: zero bleed from poisoned gutter or neighbor regions.
    for (let j = 0; j < r.nv; j++) {
      for (let i = 0; i < r.nu; i++) {
        const off = ((r.py + j) * layout.width + r.px + i) * ch;
        for (let c = 0; c < ch; c++) {
          assert.equal(out[off + c], col[c], `region ${r.name} interior (${i},${j}) ch ${c} bled`);
        }
      }
    }
    // Every gutter texel (edges AND all 4 corners) must match its clamped edge texel after blur.
    for (let j = -1; j <= r.nv; j++) {
      for (let i = -1; i <= r.nu; i++) {
        if (i >= 0 && j >= 0 && i < r.nu && j < r.nv) continue;
        const off = ((r.py + j) * layout.width + r.px + i) * ch;
        for (let c = 0; c < ch; c++) {
          assert.equal(out[off + c], col[c], `region ${r.name} gutter (${i},${j}) ch ${c} not refreshed`);
        }
      }
    }
  }

  // Also test gutter refresh when the region's own border texel changes due to blurring an edge impulse.
  const fl = layout.regions.floor;
  const edgeSrc = new Uint8Array(layout.width * layout.height * 2);
  // Put 255 at top-left interior corner (0, 0) of floor, 0 everywhere else, stale 255 in gutter.
  const cornerOff = (fl.py * layout.width + fl.px) * 2;
  edgeSrc[cornerOff] = 255;
  edgeSrc[cornerOff + 1] = 255;
  gutter(layout, edgeSrc, 2);
  const blurred = blurLightmap(edgeSrc, layout, 2, 1);
  const newCorner = blurred[cornerOff];
  assert.ok(newCorner > 0 && newCorner < 255, `corner softened from 255 to ${newCorner}`);
  // Left, top, and top-left diagonal gutter texels must all match the newly softened corner value.
  for (const [di, dj] of [[-1, 0], [0, -1], [-1, -1]]) {
    const gOff = ((fl.py + dj) * layout.width + fl.px + di) * 2;
    assert.equal(blurred[gOff], newCorner, `gutter (${di},${dj}) updated to blurred edge value`);
  }
});

test('layoutUniforms keeps SHADOWS.step by default, 1e-4 for smooth WebGL, and 0 for smooth WebGPU', () => {
  const layout = mapLayout({ W: 6, D: 8, H: 2.6, floor: true, walls: new Set(['back', 'front', 'left', 'right']) });

  const classic3 = layoutUniforms(layout, 6, 8);
  const classic1 = layoutUniforms(layout);
  const classicFalse = layoutUniforms(layout, 6, 8, { smooth: false });
  const classicGpuOff = layoutUniforms(layout, 6, 8, { smooth: false, gpu: true });
  const smoothGl4 = layoutUniforms(layout, 6, 8, { smooth: true });
  const smoothGl2 = layoutUniforms(layout, { smooth: true });
  const smoothGpu4 = layoutUniforms(layout, 6, 8, { smooth: true, gpu: true });
  const smoothGpu2 = layoutUniforms(layout, { smooth: true, gpu: true });

  assert.equal(classic3[5][2], SHADOWS.step);
  assert.equal(classic1[5][2], SHADOWS.step);
  assert.equal(classicFalse[5][2], SHADOWS.step);
  assert.equal(classicGpuOff[5][2], SHADOWS.step);
  assert.equal(smoothGl4[5][2], 1e-4);
  assert.equal(smoothGl2[5][2], 1e-4);
  assert.equal(smoothGpu4[5][2], 0);
  assert.equal(smoothGpu2[5][2], 0);

  // Region transforms and room half-sizes stay identical across all forms.
  for (const u of [classic1, classicFalse, smoothGl4, smoothGl2, smoothGpu4, smoothGpu2]) {
    assert.deepEqual(u.slice(0, 5), classic3.slice(0, 5));
    assert.equal(u[5][0], 3);
    assert.equal(u[5][1], 4);
    assert.equal(u[5][3], 0);
  }
});

/* ---- office-lighting.js ----------------------------------------------------------------------- */

const plainFixture = (id) => ({
  id,
  kind: 'plain',
  W: 12,
  D: 6,
  light: { mode: 'normal' },
  panels: [-4, -2, 2, 4].map((x) => ({ x, z: 0, state: 'on' })),
});

test('YELLOW_LIGHTING_MIX sums to 1.0 and matches expected office contrast shares', () => {
  const sum = Object.values(YELLOW_LIGHTING_MIX).reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(sum - 1) < 1e-12, `sum = ${sum}`);
  assert.equal(YELLOW_LIGHTING_MIX.steady, 0.34);
  assert.equal(YELLOW_LIGHTING_MIX.emergency, 0.02);
  assert.ok(Object.isFrozen(YELLOW_LIGHTING_MIX));
});

test('planFloorOfficeLighting produces ~60-72% varied rooms across 500 rooms, caps emergency <= 1, valid panelBank, no mutation', () => {
  const rooms = Array.from({ length: 500 }, (_, id) => plainFixture(id));
  const level = { seed: 'office-mix-500', rooms, links: [] };
  const snapshot = JSON.stringify(level);

  const plans = planFloorOfficeLighting(level, 'office');
  assert.equal(plans.length, 500);
  assert.equal(JSON.stringify(level), snapshot, 'never mutates input rooms or level');
  assert.deepEqual(plans, planFloorOfficeLighting(level, 'office'), '100% deterministic');

  // Opt-in: false/omitted returns all null.
  assert.ok(planFloorOfficeLighting(level, false).every((p) => p === null));
  assert.ok(planFloorOfficeLighting(level).every((p) => p === null));

  const varied = plans.filter(Boolean);
  const share = varied.length / rooms.length;
  assert.ok(share >= 0.60 && share <= 0.72, `varied share ${(share * 100).toFixed(1)}% should be in 60–72%`);

  const emergencies = varied.filter((p) => p.kind === 'emergency');
  assert.ok(emergencies.length <= 1, `emergency rooms ${emergencies.length} <= 1`);

  // Multiple kinds present and every plan yields valid panelBank indices & bankLevels.
  const kinds = new Set(varied.map((p) => p.kind));
  for (const expected of ['dim', 'islands', 'failing', 'travel']) {
    assert.ok(kinds.has(expected), `expected kind ${expected} across 500 rooms`);
  }

  for (let i = 0; i < rooms.length; i++) {
    const plan = plans[i];
    if (!plan) continue;
    const room = rooms[i];
    const assigned = room.panels.map((p) => panelBank(plan, p));
    for (const b of assigned) {
      assert.ok(Number.isInteger(b) && b >= 0 && b < plan.ceilingBanks, `invalid bank ${b} for ${plan.kind}`);
    }
    const unique = [...new Set(assigned)].sort((a, b) => a - b);
    assert.deepEqual(unique, Array.from({ length: plan.ceilingBanks }, (_, b) => b));

    const lv = bankLevels(plan, 12.5);
    assert.equal(lv.length, plan.bankCount);
    const lights = room.panels.map((p) => ({ ...p, bank: panelBank(plan, p) }));
    const scale = localLightScale(plan, lights, lv, 0, 0);
    assert.ok(scale >= 0 && scale <= 1.0001);
  }
});

test('planOfficeLighting delegates forced modes and keeps start room readable with neighbor doorway contrast', () => {
  const room = plainFixture(42);
  for (const forced of LIGHTING_MODES) {
    assert.deepEqual(planOfficeLighting(room, 'seed-x', forced), planLighting(room, 'seed-x', forced));
  }
  assert.equal(planOfficeLighting(room, 'seed-x', false), null);

  // Start room: always steady (null) or gentle 'dim' across many seeds — never blackout/islands/failing/emergency.
  let startSteady = 0, startDim = 0, contrastedFloors = 0;
  for (let s = 1; s <= 40; s++) {
    const level = generate(`office-start-${s}`);
    const before = JSON.stringify(level);
    const plans = planFloorOfficeLighting(level, 'office');
    assert.equal(JSON.stringify(level), before, 'generated level untouched');

    const startIdx = level.rooms.findIndex((r) => r.kind === 'start');
    const startPlan = plans[startIdx];
    if (startPlan === null) startSteady++;
    else {
      assert.equal(startPlan.kind, 'dim', `start room must stay steady or dim, got ${startPlan.kind}`);
      startDim++;
    }

    // Check immediate doorway contrast between start and its eligible plain neighbors.
    const startId = level.rooms[startIdx].id;
    const adjIndices = level.links
      .filter((l) => l.a === startId || l.b === startId)
      .map((l) => level.rooms.findIndex((r) => r.id === (l.a === startId ? l.b : l.a)))
      .filter((i) => i >= 0 && level.rooms[i].kind === 'plain' && !level.rooms[i].crawl
        && ['normal', 'dim'].includes(level.rooms[i].light.mode)
        && level.rooms[i].panels.filter((p) => p.state !== 'dead').length >= 2);
    if (adjIndices.length) {
      const hasContrast = adjIndices.some((i) => Boolean(plans[i]) !== Boolean(startPlan));
      assert.ok(hasContrast, `seed office-start-${s}: expected doorway contrast beside start room`);
      contrastedFloors++;
    }
  }
  assert.ok(startSteady > 0 && startDim > 0, `start mix steady=${startSteady}, dim=${startDim}`);
  assert.ok(contrastedFloors > 20, `${contrastedFloors} floors verified with doorway contrast at spawn`);
});

test('ballastTint is deterministic, subtle, luminance-preserving, and matches ~75/15/10 mix', () => {
  const base = [1.0, 0.95, 0.85];
  const baseL = luma(base);
  let exact = 0, cool = 0, warm = 0;

  for (let i = 0; i < 2000; i++) {
    const a = ballastTint(base, 'yellow-office', i);
    const b = ballastTint(base, 'yellow-office', i);
    assert.deepEqual(a, b, 'deterministic');
    assert.notEqual(a, base, 'returns fresh array');

    const outL = luma(a);
    assert.ok(Math.abs(outL / baseL - 1) < 1e-6, `luma preserved: ${outL} vs ${baseL}`);
    for (let c = 0; c < 3; c++) {
      assert.ok(Math.abs(a[c] / base[c] - 1) < 0.16, `subtle shift on ch ${c}: ${a[c]} vs ${base[c]}`);
    }

    if (a[0] === base[0] && a[1] === base[1] && a[2] === base[2]) exact++;
    else if (a[0] < base[0] && a[2] > base[2]) cool++;
    else if (a[0] > base[0] && a[2] < base[2]) warm++;
    else assert.fail(`unexpected ballast shift: ${a}`);
  }

  assert.ok(exact > 1400 && exact < 1600, `true ~75%: ${exact}/2000`);
  assert.ok(cool > 230 && cool < 370, `cool ~15%: ${cool}/2000`);
  assert.ok(warm > 140 && warm < 260, `warm ~10%: ${warm}/2000`);
  assert.deepEqual(ballastTint([0, 0, 0], 'zero', 0), [0, 0, 0]);
});

test('deadStarterGlow is deterministic and sparse (~10-20%) with valid end/color/power', () => {
  let hits = 0, negEnd = 0, posEnd = 0;
  for (let i = 0; i < 2000; i++) {
    const g = deadStarterGlow('room-17', i);
    assert.deepEqual(g, deadStarterGlow('room-17', i), 'deterministic');
    if (!g) continue;
    hits++;
    assert.ok(g.end === -1 || g.end === 1);
    if (g.end === -1) negEnd++; else posEnd++;
    assert.equal(g.color, '#ff8a3a');
    assert.equal(g.power, 0.35);
  }
  const rate = hits / 2000;
  assert.ok(rate >= 0.10 && rate <= 0.20, `deadStarterGlow rate ${(rate * 100).toFixed(1)}% should be ~14%`);
  assert.ok(negEnd > 0 && posEnd > 0, `both tube ends represented (${negEnd} / ${posEnd})`);
});
