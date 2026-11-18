// The Backrooms — The Offsite Reserve (`forest`): Two-Tier 2027 AAA Thicket.
//
// Builds dense claustrophobic indoor woodland in two cleanly separated tiers
// matching `docs/BACKROOMS.md` §4:
//   1. Ordinary Tier (`placeVoxStack`, collidable, `<= 120k` / `<= 240k` big):
//      Full-AO sculpted pine, birch, cypress, and snag trunks piercing 3D HVAC
//      return-plenum ceiling breaches (`plenumBreach`), plus mossy boulders,
//      hollow nurse logs, and root-split office desks (`overgrownDeskVox`),
//      each casting directional dappled bough shadows (`castCanopyShadow`).
//   2. Detail Tier (`ensureForestDetail(c)`, `mesh.userData.detail = true`,
//      non-collidable, up to `+130k` / `+260k` big):
//      Lush fern carpets, glowing mushroom keyboards, cattail reeds, rotting
//      binder piles, pinecone/bark/memo litter, heaving root-cable arches, and
//      ceiling-hung root & Spanish-moss drapes (`hangingCanopyDrapeVox`).
//
// Never blocks a doorway: walking lanes from every door to `hub` (plus `lanes`)
// are reserved before planting, and trunks stay >= 1.18 m apart.

import {
  placeVoxStack,
  ensureForestDetail,
  castCanopyShadow,
  plenumBreach,
} from './forest.js';
import { buildPnwTerrain } from './forest-maze.js';
import {
  gnarledPineVox, gnarledBirchVox, cypressBogTreeVox, charredSnagVox,
  denseHemlockVox, denseBirchStemVox, plantationSpruceVox, sweepingConiferVox,
  fernClumpVox, mushroomRingVox, fallenNurseLogVox, mossBoulderVox,
  cattailReedsVox, overgrownDeskVox, rottingBinderPileVox,
  forestLitterVox, hangingCanopyDrapeVox, rootArchVox,
  steppedGreyRockVox, bushShrubVox, pnwSwordFernClusterVox, pnwMossyStumpNurseVox,
} from './forest-models.js';

const trisOf = (m) => (m && m.solid ? (m.solid.index ? m.solid.index.count : m.solid.attributes.position.count) / 3 : 0);

/** Ordinary-batch triangles spent so far in room `c` (including pending ordinary `placeVoxStack` meshes). */
export function spentSoFar(c) {
  let n = c.rt._pendingOrdTris || 0;
  c.rt.group.traverse((o) => {
    if (o.isMesh && o.geometry && !o.userData?.detail) {
      n += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position?.count || 0) / 3;
    }
  });
  for (const b of [c.vox, c.glass, c.flat, c.wall, c.floor, c.ceil]) {
    if (b && b.idx) n += b.idx.length / 3;
  }
  return n + c.decals.idx.length / 3;
}

/** Keep a lane clear: reserved circles every 0.45 m from `(x0, z0)` to `(x1, z1)`. */
export function keepLane(c, x0, z0, x1, z1, width = 1.3) {
  const len = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.ceil(len / 0.45));
  for (let i = 0; i <= n; i++) c.reserve(x0 + ((x1 - x0) * i) / n, z0 + ((z1 - z0) * i) / n, width / 2);
}

/** Lanes from every doorway (0.6 m in) to the hub. */
export function doorLanes(c, hub = [0, 0], width = 1.3) {
  for (const dr of c.room.doors) {
    const p = c.doorPoint(dr, 0.6);
    keepLane(c, p.x, p.z, hub[0], hub[1], width);
  }
}

/**
 * Keep clear the way a visitor really has from the first doorway to each of the others, round whatever already stands
 * in the room. A straight lane from a doorway to the middle (`doorLanes`) is no use in a plain room whose own layout
 * (quiet.js: hedge baffles, trunks, a dogleg) stands across it: the visitor goes round, over ground nobody reserved,
 * and the thicket planted there. On about one forest floor in four that walled a doorway off, and the level's safety
 * net then switched every collider in the room off (trunks you walk through). This walks the room on a quarter-metre
 * grid, with a berth round whatever cannot be walked so far, and reserves the route it finds. Draws nothing from the seed.
 */
export function doorRoutes(c, width = 1.3) {
  const { W, D } = c, doors = c.room.doors || [];
  if (doors.length < 2) return 0;
  const step = 0.25, nx = Math.floor(W / step), nz = Math.floor(D / step);
  if (nx < 2 || nz < 2) return 0;
  const cols = (c.rt.colliders || []).filter((k) => k.on !== false);
  const at = (i, j) => [-W / 2 + (i + 0.5) * step, -D / 2 + (j + 0.5) * step];
  // (what can be walked is the level's own answer, the one its doorway check will ask afterwards: world.walkable knows
  // about a plain room's thin partitions and low places as well as what is solid. Failing that, only what is solid)
  let walk = null;
  try { walk = c.world?.walkable?.(c.rt) || null; walk?.free(0, 0); } catch { walk = null; }
  const open = (pad) => {
    const free = new Uint8Array(nx * nz);
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
      const [x, z] = at(i, j);
      if (walk) {
        free[i * nz + j] = walk.free(x, z) && walk.free(x + pad, z) && walk.free(x - pad, z) && walk.free(x, z + pad) && walk.free(x, z - pad) ? 1 : 0;
      } else {
        const w = c.toWorld(x, z), q = pad + 0.22;
        free[i * nz + j] = cols.some((k) => w.x > k.x0 - q && w.x < k.x1 + q && w.z > k.z0 - q && w.z < k.z1 + q) ? 0 : 1;
      }
    }
    return free;
  };
  const cellOf = (free, p) => {
    let best = -1, bd = Infinity;
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
      if (!free[i * nz + j]) continue;
      const [x, z] = at(i, j), d = Math.hypot(x - p.x, z - p.z);
      if (d < bd) { bd = d; best = i * nz + j; }
    }
    return best;
  };
  let kept = 0;
  const from = c.doorPoint(doors[0], 0.6);
  for (let n = 1; n < doors.length; n++) {
    const to = c.doorPoint(doors[n], 0.6);
    // (as wide a berth as there is: a tight gap between two baffles is still the way, if it is the only one)
    for (const pad of [0.3, 0.15, 0.02]) {
      const free = open(pad), a = cellOf(free, from), b = cellOf(free, to);
      if (a < 0 || b < 0) continue;
      const prev = new Int32Array(nx * nz).fill(-1), queue = [a];
      prev[a] = a;
      for (let q = 0; q < queue.length && prev[b] < 0; q++) {
        const k = queue[q], i = Math.floor(k / nz), j = k % nz;
        for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const ii = i + di, jj = j + dj;
          if (ii < 0 || jj < 0 || ii >= nx || jj >= nz) continue;
          const kk = ii * nz + jj;
          if (free[kk] && prev[kk] < 0) { prev[kk] = k; queue.push(kk); }
        }
      }
      if (prev[b] < 0) continue;
      const [bx, bz] = at(Math.floor(b / nz), b % nz), [ax, az] = at(Math.floor(a / nz), a % nz);
      keepLane(c, to.x, to.z, bx, bz, width);
      keepLane(c, from.x, from.z, ax, az, width);
      for (let k = b, m = 0; ; k = prev[k], m++) {
        if (m % 2 === 0 || k === a) { const [x, z] = at(Math.floor(k / nz), k % nz); c.reserve(x, z, width / 2); kept++; }
        if (k === a) break;
      }
      break;
    }
  }
  return kept;
}

export function thicket(c, opt = {}) {
  const { W, D, R, kit } = c;
  const area = W * D;
  const isBig = !!opt.big;

  const region = opt.region || (() => true);

  // Reserve walking lanes BEFORE building stepped Pacific Northwest rock/dirt hills & planting trees!
  if (opt.hub !== null) doorLanes(c, opt.hub || [0, 0], opt.laneWidth ?? 1.35);
  if (opt.routes) doorRoutes(c, opt.laneWidth ?? 1.35);
  for (const [x0, z0, x1, z1, w] of opt.lanes || []) keepLane(c, x0, z0, x1, z1, w ?? 1.35);

  // Build Pacific Northwest stepped rock/dirt/moss hills automatically unless disabled or already built!
  if (opt.hills !== false && !c.rt._pnwBuilt) {
    const inferredStyle = opt.under === 0
      ? 'scorched'
      : opt.wet
        ? 'peat'
        : 'rainforest';
    buildPnwTerrain(c, { style: inferredStyle, big: isBig, region, ...(opt.hillsOpt || {}) });
  }

  const det = ensureForestDetail(c);

  // 1. Ordinary-tier budget (`<= 120,000` normal / `<= 240,000` set piece, keeping safe margin for signs/shell)
  const ordCap = Math.min(opt.ordCap ?? (isBig ? 225000 : 110000), isBig ? 226000 : 111000);
  const ordLeft = Math.max(0, ordCap - spentSoFar(c));
  const ordBudget = Math.min(
    opt.budget ?? Math.max(32000, Math.min(isBig ? 172000 : 92000, area * 1120)),
    ordLeft
  );

  // 2. Detail-tier budget (`mesh.userData.detail = true`, `<= 130,000` normal / `<= 260,000` set piece)
  const detCap = Math.min(opt.detCap ?? (isBig ? 244000 : 121000), isBig ? 245000 : 122000);
  const detBudget = opt.detail === false
    ? 0
    : (opt.detBudget ?? Math.max(28000, Math.min(isBig ? 178000 : 98000, area * 1180)));

  const species = opt.species || { sweeping: 3, hemlock: 5, birchStem: 3, pine: 1 };
  const minSpacing = opt.spacing ?? 0.86;
  const nTrees = opt.trees ?? Math.round(area / 2.5);
  const nHeavyProps = opt.heavyProps ?? Math.max(2, Math.round(area / 20));
  const nUnder = opt.under ?? Math.round(area / 1.65);
  const out = { trees: [], companions: 0, under: [], spent: 0, detailSpent: 0 };

  // Returns terrace elevation `>= 0`, or `-1` if `pad` straddles a voxel step drop!
  const terraceY = (x, z, pad = 0.16) => {
    if (!c.rt.pnwTopAt) return 0;
    const y0 = c.rt.pnwTopAt(x, z);
    if (y0 <= 0.001 || pad <= 0) return y0;
    if (
      c.rt.pnwTopAt(x - pad, z) < y0 - 0.01
      || c.rt.pnwTopAt(x + pad, z) < y0 - 0.01
      || c.rt.pnwTopAt(x, z - pad) < y0 - 0.01
      || c.rt.pnwTopAt(x, z + pad) < y0 - 0.01
    ) {
      return -1;
    }
    return y0;
  };

  const ordEntries = [];

  const affordOrd = (key, make) => {
    const cost = trisOf(kit.model(key, make));
    if (out.spent + cost > ordBudget) return false;
    out.spent += cost;
    return true;
  };
  const affordDet = (key, make) => {
    const cost = trisOf(kit.model(key, make));
    if (out.detailSpent + cost > detBudget || det.totalTris() + cost > detCap) return false;
    out.detailSpent += cost;
    return true;
  };

  const far = (x, z, list, d) => list.every((t) => Math.hypot(t.x - x, t.z - z) >= d);
  const pickSpecies = () => {
    const tot = Object.values(species).reduce((a, b) => a + b, 0);
    let r = R() * tot;
    for (const [k, w] of Object.entries(species)) { r -= w; if (r <= 0) return k; }
    return 'hemlock';
  };

  /* ---- A. Ordinary Tier: Full-AO Trunks, Nurse Stumps, Boulders, Logs & Desks ---- */
  for (let i = 0, tries = 0; i < nTrees && tries < nTrees * 18; tries++) {
    const x = R.range(-W / 2 + 0.46, W / 2 - 0.46), z = R.range(-D / 2 + 0.46, D / 2 - 0.46);
    if (!region(x, z) || !c.clear(x, z, 0.28) || !far(x, z, out.trees, minSpacing)) continue;
    const y0 = terraceY(x, z, 0.16);
    if (y0 < 0) continue;
    const top = c.ceilAt(x, z);
    if (top - y0 < 1.85) continue;
    const sp = pickSpecies();
    const scale = sp === 'pine' ? 0.036 : sp === 'birchStem' ? 0.032 : 0.034;
    const tall = Math.max(48, Math.round((top - y0 + 0.18) / scale));
    const make = sp === 'birch'
      ? gnarledBirchVox(tall)
      : sp === 'birchStem'
        ? denseBirchStemVox(tall)
        : sp === 'sweeping'
          ? sweepingConiferVox(tall)
          : sp === 'hemlock'
            ? denseHemlockVox(tall, !!opt.fiberGlow && (i % 3 === 0))
            : sp === 'spruce'
              ? plantationSpruceVox(tall, !!opt.greenDrip)
              : sp === 'cypress'
                ? cypressBogTreeVox(tall)
                : sp === 'snag'
                  ? charredSnagVox(tall)
                  : gnarledPineVox(tall, true);
    const key = `forest:thicket:${sp}:${tall}:${opt.fiberGlow && (i % 3 === 0) ? 'fg' : opt.greenDrip ? 'gd' : '0'}`;
    if (!affordOrd(key, make)) break;

    const rot = R.range(0, Math.PI * 2);
    ordEntries.push({ key, make, x, y: y0, z, rot, scale });
    const r = sp === 'cypress' ? 0.30 : sp === 'birchStem' ? 0.17 : 0.21;
    c.reserve(x, z, r + 0.12);
    if (y0 < 0.05) {
      c.solid(x - r, z - r, x + r, z + r, { tall: true });
      castCanopyShadow(c, x, z, sp === 'pine' ? 1.55 : 1.18, i + c.room.id);
    }
    if (opt.ceiling !== false && top < 6.8 && (out.trees.length < 18 || i % 2 === 0)) {
      plenumBreach(c, x - 0.15, z - 0.15, 1, i + c.room.id * 3);
    }
    out.trees.push({ x, z, y: y0, sp, top });
    i++;
  }

  // Collidable mossy boulders, PNW cedar nurse stumps, nurse logs & root-cracked office desks (`under === 0` skips in burned rooms)
  if (nUnder > 0) {
    let logs = 0, desks = 0, stumps = 0;
    for (let i = 0, tries = 0; i < nHeavyProps && tries < nHeavyProps * 14; tries++) {
      const pick = R();
      const kind = pick < 0.18 && desks < 1 && area >= 120
        ? 'desk'
        : pick < 0.42 && logs < 2
          ? 'log'
          : pick < 0.72 && stumps < 4
            ? 'stump'
            : 'boulder';
      const footR = kind === 'log' ? 0.82 : kind === 'desk' ? 0.78 : kind === 'stump' ? 0.48 : 0.45;
      const x = R.range(-W / 2 + footR + 0.25, W / 2 - footR - 0.25);
      const z = R.range(-D / 2 + footR + 0.25, D / 2 - footR - 0.25);
      if (!region(x, z) || !c.clear(x, z, footR)) continue;
      const y0 = (kind === 'boulder' || kind === 'stump') ? terraceY(x, z, 0.20) : terraceY(x, z, 0.45);
      if (y0 < 0 || (kind === 'desk' && y0 > 0.02) || c.ceilAt(x, z) - y0 < 1.55) continue;

      const make = kind === 'desk'
        ? overgrownDeskVox()
        : kind === 'log'
          ? fallenNurseLogVox()
          : kind === 'stump'
            ? pnwMossyStumpNurseVox()
            : mossBoulderVox();
      const key = `forest:heavy:${kind}`;
      if (!affordOrd(key, make)) break;

      const rot = kind === 'log' || kind === 'desk' ? R.pick([0, Math.PI * 0.5, Math.PI, Math.PI * 1.5]) + R.range(-0.12, 0.12) : R.range(0, Math.PI * 2);
      const scale = kind === 'boulder' ? R.range(0.030, 0.042) : kind === 'stump' ? R.range(0.030, 0.036) : 0.030;
      ordEntries.push({ key, make, x, y: y0, z, rot, scale });
      if (kind === 'boulder' || kind === 'stump') {
        if (y0 < 0.05) c.solid(x - 0.30, z - 0.28, x + 0.30, z + 0.28);
        c.reserve(x, z, 0.46);
        if (kind === 'stump') stumps++;
      } else if (kind === 'log') {
        const alongX = Math.abs(Math.sin(rot)) > 0.7;
        if (y0 < 0.05) c.solid(x - (alongX ? 0.70 : 0.24), z - (alongX ? 0.24 : 0.70), x + (alongX ? 0.70 : 0.24), z + (alongX ? 0.24 : 0.70));
        c.reserve(x, z, 0.85);
        logs++;
      } else {
        const alongX = Math.abs(Math.cos(rot)) > 0.7;
        c.solid(x - (alongX ? 0.62 : 0.32), z - (alongX ? 0.32 : 0.62), x + (alongX ? 0.62 : 0.32), z + (alongX ? 0.32 : 0.62));
        c.reserve(x, z, 0.82);
        desks++;
      }
      if (y0 < 0.05) c.blot(x, z, footR * 2.1, footR * 2.1, { rgb: [0.04, 0.05, 0.03], a: 0.44 });
      i++;
    }
  }

  if (ordEntries.length) {
    placeVoxStack(c, `forest:thicket:${c.room.id}:${opt.tag || 'main'}`, ordEntries);
  }

  /* ---- B. Detail Tier (`mesh.userData.detail = true`): Twin Sapling Stems, PNW Flora, Rocks & Ceiling Drapes ---- */
  if (detBudget > 0 && nUnder > 0) {
    const nCompanion = opt.companionStems ?? Math.min(34, Math.floor(out.trees.length * 0.82));
    for (let k = 0; k < nCompanion; k++) {
      const parent = out.trees[k % out.trees.length];
      if (!parent) break;
      const ang = R.range(0, Math.PI * 2);
      let rad = R.range(0.42, 0.68);
      let sx = parent.x + Math.cos(ang) * rad, sz = parent.z + Math.sin(ang) * rad;
      if (!region(sx, sz) || !c.clear(sx, sz, 0.08)) {
        rad = R.range(0.22, 0.27);
        sx = parent.x + Math.cos(ang) * rad;
        sz = parent.z + Math.sin(ang) * rad;
      }
      if (Math.abs(sx) > W / 2 - 0.35 || Math.abs(sz) > D / 2 - 0.35) continue;
      const sy = terraceY(sx, sz, 0.12);
      if (sy < 0 || parent.top - sy < 1.8) continue;
      const sScale = R.range(0.028, 0.032);
      const sTall = Math.max(48, Math.round((parent.top - sy + 0.12) / sScale));
      const isBirch = (k % 3) === 0;
      const make = isBirch ? denseBirchStemVox(sTall) : denseHemlockVox(sTall, false);
      const key = `forest:detail:stem:${isBirch ? 'b' : 'h'}:${sTall}`;
      if (!affordDet(key, make)) break;
      det.pushVox({ key, make, x: sx, y: sy, z: sz, rot: R.range(0, Math.PI * 2), scale: sScale });
      if (sy < 0.05) c.blot(sx, sz, 0.72, 0.72, { rgb: [0.04, 0.06, 0.03], a: 0.38 });
      out.companions++;
    }

    const kinds = opt.underKinds || [
      ['swordFern', 8],
      ['fern', 7],
      ['steppedRock', 3],
      ['shrub', 3],
      ['litter', 5],
      ['mushrooms', 3],
      ['binders', 2],
      ['arch', 1],
      ...(opt.wet ? [['reeds', 6]] : []),
    ];
    const pickKind = () => {
      const tot = kinds.reduce((a, k) => a + k[1], 0);
      let r = R() * tot;
      for (const [k, w] of kinds) { r -= w; if (r <= 0) return k; }
      return 'swordFern';
    };

    for (let i = 0, tries = 0; i < nUnder && tries < nUnder * 9; tries++) {
      const kind = pickKind();
      const near = out.trees.length && R.chance(0.64) ? R.pick(out.trees) : null;
      const x = near ? near.x + R.range(-1.05, 1.05) : R.range(-W / 2 + 0.42, W / 2 - 0.42);
      const z = near ? near.z + R.range(-1.05, 1.05) : R.range(-D / 2 + 0.42, D / 2 - 0.42);
      if (Math.abs(x) > W / 2 - 0.36 || Math.abs(z) > D / 2 - 0.36 || !region(x, z)) continue;
      if ((kind === 'arch' || kind === 'steppedRock' || kind === 'shrub') && !c.clear(x, z, 0.45)) continue;
      const y0 = terraceY(x, z, kind === 'litter' ? 0.08 : 0.14);
      if (y0 < 0 || c.ceilAt(x, z) - y0 < 0.95) continue;
      if (kind === 'arch' && y0 > 0.02) continue;

      const make = kind === 'swordFern'
        ? pnwSwordFernClusterVox()
        : kind === 'fern'
          ? fernClumpVox()
          : kind === 'steppedRock'
            ? steppedGreyRockVox()
            : kind === 'shrub'
              ? bushShrubVox()
              : kind === 'mushrooms'
                ? mushroomRingVox()
                : kind === 'reeds'
                  ? cattailReedsVox()
                  : kind === 'binders'
                    ? rottingBinderPileVox()
                    : kind === 'arch'
                      ? rootArchVox()
                      : forestLitterVox();
      const key = `forest:detail:${kind}`;
      if (!affordDet(key, make)) break;

      const scale = kind === 'swordFern'
        ? R.range(0.028, 0.036)
        : kind === 'fern'
          ? R.range(0.025, 0.034)
          : kind === 'steppedRock' || kind === 'shrub'
            ? R.range(0.028, 0.034)
            : kind === 'litter'
              ? R.range(0.024, 0.030)
              : 0.028;
      det.pushVox({ key, make, x, y: y0 - 0.008, z, rot: R.range(0, Math.PI * 2), scale });
      out.under.push({ x, z, y: y0, kind });
      i++;
    }

    // Lush ceiling-hung bough/Spanish-moss/Cat-5 drapes around ceiling breaches (`detail: true`)!
    if (opt.ceiling !== false) {
      for (const t of out.trees) {
        if (t.top > 6.6 || !R.chance(0.75)) continue;
        const make = hangingCanopyDrapeVox();
        const key = 'forest:detail:ceildrape';
        if (!affordDet(key, make)) break;
        det.pushVox({
          key,
          make,
          x: t.x + R.range(-0.22, 0.22),
          y: t.top + 0.02,
          z: t.z + R.range(-0.22, 0.22),
          rot: R.range(0, Math.PI * 2),
          scale: 0.028,
        });
      }
    }
  }

  /* ---- C. Floor Leaf-Litter Drifts ---- */
  for (let i = 0; i < Math.round(area / 2.4); i++) {
    const t = out.trees.length && R.chance(0.72) ? R.pick(out.trees) : null;
    const x = t ? t.x + R.range(-1.1, 1.1) : R.range(-W / 2 + 0.4, W / 2 - 0.4);
    const z = t ? t.z + R.range(-1.1, 1.1) : R.range(-D / 2 + 0.4, D / 2 - 0.4);
    if (Math.abs(x) > W / 2 - 0.2 || Math.abs(z) > D / 2 - 0.2) continue;
    if (c.rt.pnwTopAt && c.rt.pnwTopAt(x, z) > 0.02) continue;
    c.blot(x, z, R.range(0.55, 1.5), R.range(0.55, 1.5), {
      rgb: R.pick(opt.litter || [[0.14, 0.09, 0.04], [0.08, 0.11, 0.04], [0.18, 0.12, 0.05]]),
      a: R.range(0.22, 0.44),
      y: 0.007 + (i % 5) * 0.0004,
    });
  }

  c.rt.thicket = (c.rt.thicket || 0) + out.trees.length + out.companions;
  return out;
}
