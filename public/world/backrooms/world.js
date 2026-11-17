// The Backrooms — the world: turns a generated level (gen.js) into rooms you
// can stand in. For every room it builds the shell — carpet, wallpaper with
// holes for the doorways and windows, a drop ceiling with its tube panels,
// and whatever the room's shape calls for: stairs up to a doorway, a pit, a
// ceiling that steps or slopes, a beam to duck under — hands a builder
// (rooms.js) a small toolbox to furnish it, bakes the light, and keeps what
// the game needs afterwards: where you can walk and how high the floor and
// the ceiling are there, what you can use, what moves.
import * as THREE from 'three';
import { T, TILE, RISE, RUN, toWorld, toLocal, wallLength, wallPoint, wallSpans, floorAt, ceilAt, headAt, fitsAt, stairZones, makeRng, roomPath } from './gen.js';
import { Batch, lamp, lightAt, lin, ticks, smooth, WHITE } from './kit.js';
import { FURNITURE, furnitureType, fixedFurnitureReason, onFurniture, overlaps, worldFootprint, boxHits } from './furniture-policy.js';
import { fixedFurnitureFoot } from '../props/trolley.js';
import { emergencyFixtures } from './lighting-fixtures.js';
import { CEILING, lightVox } from './ceiling.model.js';
import { planFloorLighting, panelBank, bankLevels, localLightScale } from './lighting.js';
import { registerMovable } from './movable-props.js';
import { surfaceAt } from './bridge-rules.js';
import { mapLayout, bakeShadows, packShadows, layoutUniforms, sampleMap, bakeDoorway, packDoorways, lampPoints, groupOf, groupCount, SHADOWS } from './shadowmap.js';
import { doorPlan, DOORS } from './doors.js';
import { bridgeReachable } from './bridge-puzzles.js';
import { LEVEL_DESK, deskVox } from './desk.model.js';
import { chooseUse } from './use.rule.js';
import { WORKSTATION, chairVox, crtVox, keyboardVox, keyboardKeysVox } from './workstation.model.js';
import { STORAGE, cabinetVox, boxesVox } from './storage.model.js';
import { SMALLS, binVox, trolleyVox, coolerVox } from './smalls.model.js';
import { WALLFIT, socketVox, exitBoxVox } from './wallfit.model.js';
import { markLiquid } from './liquid.mark.js';

// each local wall: the way it faces, the direction it runs (U = up × normal), where it starts,
// and how far along it a local coordinate c is (c is x on the front/back walls, z on the side walls)
const WALLS = {
  back: { n: [0, 0, 1], U: [1, 0, 0], o: (W, D) => [-W / 2, 0, -D / 2], s: (c, W) => c + W / 2 },
  front: { n: [0, 0, -1], U: [-1, 0, 0], o: (W, D) => [W / 2, 0, D / 2], s: (c, W) => W / 2 - c },
  left: { n: [1, 0, 0], U: [0, 0, -1], o: (W, D) => [-W / 2, 0, D / 2], s: (c, W, D) => D / 2 - c },
  right: { n: [-1, 0, 0], U: [0, 0, 1], o: (W, D) => [W / 2, 0, -D / 2], s: (c, W, D) => c + D / 2 },
};
const UP = [0, 1, 0], VOX = 0.025, STEP = 0.26, HEAD = 0.62;
// (kit.gfx.fixtures) where on the flat panel's texture its tubes are white: the sculpted tubes are drawn with that one
// spot of it, in the same batch the flat panel would have been in, so that they shine and fail exactly as it did
const TUBE_UV = [7 / 24, 0.5];
// …and where it is the diffuser's shade, a little under the tubes: the inside of a lit fitting's pan, seen through its
// louvre, shines at it (in the same batch, so it goes dark exactly when the tubes do). A fitting that is out has the
// inside of its pan in the shadow of its own box (the bake has no shadow of its own there): DARK_PAN. The blades are
// lit by the room, a little darker than the model paints them so that they read as lines across the glow: LOUVRE.
const PAN_UV = [2.5 / 24, 0.5], DARK_PAN = [0.3, 0.3, 0.3], LOUVRE = [0.6, 0.6, 0.6];
const pans = new WeakMap();
/** A meshed housing (ceiling.model.js) split in two: the pan's inside (its pale faces above the trim that face down or
 * in, what is seen through the louvre) and the rest (trim, holders, the pan's back). Each its own compact geometry. */
export function panOf(geo) {
  if (pans.has(geo)) return pans.get(geo);
  const p = geo.attributes.position, n = geo.attributes.normal, col = geo.attributes.color, idx = geo.index.array, pick = [[], []];
  for (let t = 0; t < idx.length; t += 3) {
    let cx = 0, cy = 0, cz = 0, lum = 0;
    for (let k = 0; k < 3; k++) { const v = idx[t + k]; cx += p.getX(v) / 3; cy += p.getY(v) / 3; cz += p.getZ(v) / 3; lum += (col.getX(v) + col.getY(v) + col.getZ(v)) / 9; }
    const v = idx[t], ny = n.getY(v), inward = -(n.getX(v) * cx + n.getZ(v) * cz) > 0;
    pick[cy > 1 && lum > 0.6 && (ny < -0.5 || (Math.abs(ny) < 0.5 && inward)) ? 0 : 1].push(idx[t], idx[t + 1], idx[t + 2]);
  }
  const compact = (list) => {
    const map = new Map(), out = new THREE.BufferGeometry(), attrs = Object.entries(geo.attributes), data = attrs.map(() => []);
    const index = list.map((v) => { if (!map.has(v)) { map.set(v, map.size); attrs.forEach(([, a], k) => { for (let c = 0; c < a.itemSize; c++) data[k].push(a.array[v * a.itemSize + c]); }); } return map.get(v); });
    attrs.forEach(([name, a], k) => out.setAttribute(name, new THREE.Float32BufferAttribute(data[k], a.itemSize)));
    out.setIndex(index);
    return list.length ? out : null;
  };
  const split = { inside: compact(pick[0]), rest: compact(pick[1]) };
  pans.set(geo, split);
  return split;
}
const P = (g, col, x, y, w, h) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
/** Vertex positions from a to b with one at every ceiling-tile seam (seams are at multiples of TILE). */
const tiles = (a, b) => { const out = [0]; for (let p = Math.ceil((a + 0.05) / TILE) * TILE; p < b - 0.05; p += TILE) out.push(p - a); out.push(b - a); return out; };

// Retain whole authored primitives when separating a desktop from the room
// bake. Splitting individual triangles can leave half a monitor on the wall.
function chunkBounds(batch, start, end) {
  const foot = { x0: Infinity, z0: Infinity, x1: -Infinity, z1: -Infinity, bottom: Infinity, top: -Infinity };
  for (let i = start; i < end; i++) {
    const x = batch.pos[i * 3], y = batch.pos[i * 3 + 1], z = batch.pos[i * 3 + 2];
    foot.x0 = Math.min(foot.x0, x); foot.x1 = Math.max(foot.x1, x);
    foot.z0 = Math.min(foot.z0, z); foot.z1 = Math.max(foot.z1, z);
    foot.bottom = Math.min(foot.bottom, y); foot.top = Math.max(foot.top, y);
  }
  return foot;
}
function copyChunks(batch, chunks, decals = false) {
  const result = decals ? { pos: [], uv: [], col: [], idx: [] } : new Batch(batch.vox);
  const fields = decals ? { pos: 3, uv: 2, col: 4 } : { pos: 3, nor: 3, uv: 2, alb: 3, ao: 1, vx: 3, sf: 2 };
  for (const q of chunks) {
    const offset = result.pos.length / 3 - q.start;
    for (const [key, stride] of Object.entries(fields)) {
      if (!batch[key]?.length) continue;
      for (let i = q.start * stride; i < q.end * stride; i++) result[key].push(batch[key][i]);
    }
    for (let i = q.first; i < q.last; i++) result.idx.push(batch.idx[i] + offset);
  }
  return result;
}

/* ---- light worked out once with the room, beyond the lamps (kit.gfx: off unless asked for) ----------------------
 * Contact: where something stands on the floor or against a wall, the floor and wall near it (and anything else beside
 * it) are a little darker, and so are its own lower sides, near the floor. Bounce: the carpet's colour, as lit as the
 * carpet is where it comes from, a little way up the walls and under things; the wallpaper's on the floor and ceiling
 * by the walls. Both from what the room already knows once it is built: the boxes, models and pillars put down in it
 * (no triangles are traced, and none are added: the floor's vertices every half metre carry the gradient, and the
 * round blot under each thing is still the sharp part). Nothing runs per frame. */
// (doorlight) DOOR_GAIN: the light through a doorway, against the bake's own falloff, which was tuned for a room lit by
// its own tubes and a big ambient share: through a doorway there is no ambient to carry it, and the eye goes to it.
// SPILL_DOOR: the old glow at a doorway from a brighter room next door, kept at this share when the doorway's own light
// is baked (it still lights the ceiling and what stands there, which the map does not reach).
// DOOR_FADE: seconds a doorway's light takes to come up when it is baked late (env.lateDoorLight) while its part is being
// drawn and lit frame by frame.
const DOOR_GAIN = 2.5, SPILL_DOOR = 0.5, DOOR_FADE = 0.8;
const CONTACT = 0.7, SELF = 0.45, SELF_H = 0.4, BOUNCE_FLOOR = 0.6, BOUNCE_WALL = 0.4, EDGE = 0.9, SHADE_BODY = 0.75;
const NO_OCCLUDERS = [];

/** The things that darken what is near them, kept in a 1 m grid of the room's floor: near(x, z) → the few that may reach there. */
function occluderGrid(list) {
  const cells = new Map(), key = (i, j) => (i + 1024) * 2048 + (j + 1024);
  for (const o of list) {
    for (let i = Math.floor(o.x0 - o.R); i <= Math.floor(o.x1 + o.R); i++) for (let j = Math.floor(o.z0 - o.R); j <= Math.floor(o.z1 + o.R); j++) {
      const k = key(i, j); if (!cells.has(k)) cells.set(k, []); cells.get(k).push(o);
    }
  }
  return (x, z) => cells.get(key(Math.floor(x), Math.floor(z))) || NO_OCCLUDERS;
}

/**
 * What one batch gets from kit.gfx, for kit.bake: → { ao, bounce } or null. key: which of the room's batches
 * ('floor', 'wall', 'ceil' are the shell's). g: { near, floorAt, W, D, floorRgb, wallRgb, sides } for the room; near is
 * null for a batch that moves (a desk that can be dragged keeps only what is its own: its lower sides, the bounce under it).
 */
function gfxExtra(batch, key, gfx, g) {
  const n = batch.verts;
  if (!n) return null;
  const pos = batch.pos, nor = batch.nor, glow = batch.vox ? batch.sf : null, { contact, bounce } = gfx;
  const shell = key === 'wall' || key === 'floor' || key === 'ceil', edgeOf = key === 'floor' || key === 'ceil';
  const hw = g.W / 2, hd = g.D / 2;
  let ao = null, w = null, src = null, rgb = null;
  for (let i = 0; i < n; i++) {
    if (glow && glow[i * 2 + 1] > 0.5) continue;                     // (what shines by itself is not lit at all)
    const j = i * 3, px = pos[j], py = pos[j + 1], pz = pos[j + 2], nx = nor[j], ny = nor[j + 1], nz = nor[j + 2];
    const hgt = py - g.floorAt(px, pz);
    if (contact > 0) {
      let k = 1;
      if (g.near) {
        let open = 1;
        for (const o of g.near(px, pz)) {
          const R = o.R;
          if (px < o.x0 - R || px > o.x1 + R || pz < o.z0 - R || pz > o.z1 + R || py < o.y0 - R || py > o.y1 + R) continue;
          // a vertex inside a thing is its own (or something tucked in it): it is not shaded by it. The floor never is.
          if (key !== 'floor' && px >= o.x0 && px <= o.x1 && pz >= o.z0 && pz <= o.z1 && py > o.y0 + 0.02 && py < o.y1 + 0.02) continue;
          const dx = clamp(px, o.x0, o.x1) - px, dy = clamp(py, o.y0, o.y1) - py, dz = clamp(pz, o.z0, o.z1) - pz, d = Math.hypot(dx, dy, dz);
          if (d >= R) continue;
          const cx = (o.x0 + o.x1) / 2 - px, cy = (o.y0 + o.y1) / 2 - py, cz = (o.z0 + o.z1) / 2 - pz;
          const f = (cx * nx + cy * ny + cz * nz) / (Math.hypot(cx, cy, cz) || 1);          // in front of this surface, and how much of what it faces
          if (f <= 0) continue;
          open *= 1 - (1 - smooth(d / R)) * Math.sqrt(f);
        }
        k *= 1 - contact * CONTACT * (1 - open);
      }
      // its own lower sides and underneath, near the floor (the shell's walls have their own: world.js shell)
      if (!shell && ny < 0.6 && hgt > -0.03 && hgt < SELF_H) k *= 1 - contact * SELF * (1 - smooth(hgt / SELF_H)) * (ny < -0.5 ? 1 : 0.8);
      if (k < 1) { if (!ao) ao = new Float32Array(n).fill(1); ao[i] = k; }
    }
    if (bounce > 0) {
      let wt = 0, sx = 0, sy = 0, sz = 0, snx = 0, sny = 1, snz = 0, col = null;
      if (edgeOf) {
        // the wallpaper's colour on the floor (and the ceiling) near a wall: from the wall beside it, half a metre off the floor (or below the ceiling)
        if (g.wallRgb && (key === 'floor' ? ny > 0.7 : ny < -0.7)) {
          let best = Infinity, side = null;
          for (const [name, dist] of [['back', pz + hd], ['front', hd - pz], ['left', px + hw], ['right', hw - px]]) if (g.sides.has(name) && dist < best) { best = dist; side = name; }
          if (side && best < EDGE && best > -0.05) {
            wt = bounce * BOUNCE_WALL * (1 - smooth(Math.max(0, best) / EDGE)); col = g.wallRgb;
            sx = side === 'left' ? -hw + 0.02 : side === 'right' ? hw - 0.02 : px; sz = side === 'back' ? -hd + 0.02 : side === 'front' ? hd - 0.02 : pz;
            snx = side === 'left' ? 1 : side === 'right' ? -1 : 0; snz = side === 'back' ? 1 : side === 'front' ? -1 : 0; sny = 0;
            sy = key === 'floor' ? py + 0.5 : py - 0.45;
          }
        }
      } else if (g.floorRgb && ny < 0.3 && hgt > -0.03) {
        // the carpet's colour, up the lower part of anything that faces it: walls, the sides of things, their undersides most
        const reach = ny < -0.5 ? 1.5 : 0.9;
        if (hgt < reach) {
          wt = bounce * BOUNCE_FLOOR * (1 - smooth(hgt / reach)) * (ny < 0 ? 1 : 1 - ny / 0.3); col = g.floorRgb;
          sx = clamp(px + nx * 0.3, -hw + 0.05, hw - 0.05); sz = clamp(pz + nz * 0.3, -hd + 0.05, hd - 0.05); sy = g.floorAt(sx, sz);
        }
      }
      if (wt > 1e-4) {
        if (!w) { w = new Float32Array(n); src = new Float32Array(n * 6); rgb = new Float32Array(n * 3); }
        w[i] = wt; src.set([sx, sy, sz, snx, sny, snz], i * 6); rgb[j] = col[0]; rgb[j + 1] = col[1]; rgb[j + 2] = col[2];
      }
    }
  }
  return ao || w ? { ao, bounce: w ? { w, src, rgb } : null } : null;
}

/* ---- the tubes' shadows, baked (kit.gfx.shadows: off unless asked for) ------------------------------------------
 * What stands in the room is what the contact darkening already records (`standing`: boxes drawn into the room's own
 * batches, models put down, pillars), less anything that can be dragged about (it keeps its round blot instead, and
 * leaves no shadow behind). A model is not its bounding box: its triangles are gathered into columns 10 cm across, so a
 * chair throws a seat and four legs, not a crate. shadowmap.js does the rest. */
const SHADOW_COL = 0.1, SHADOW_COLS = 6, BLOT_FADE = 0.3;

/* ---- light through the doorways (kit.gfx.doorlight: off unless asked for) ----------------------------------------
 * Once every room is built (the room next door's lamps are known only then), each room with a light map gets the light of
 * its neighbours through up to four of its doorways (shadowmap.js bakeDoorway), and each frame each doorway's share is
 * scaled by how open it is (a hung door's swing, doorleaf.js; a doorway shut some other way: world.throats) and how lit
 * the room beyond it is (its banks, its flicker, its dimmer). */

/** Room a's frame → room b's: a point (x, y, z). */
const across = (a, b) => (x, y, z) => { const w = toWorld(a, x, z), l = toLocal(b, w.x, w.z); return [l.x, y + (a.y || 0) - (b.y || 0), l.z]; };
/** A box from one room's frame into another's. */
const boxAcross = (mv, q) => { const p = mv(q.x0, q.y0, q.z0), r = mv(q.x1, q.y1, q.z1); return { x0: Math.min(p[0], r[0]), y0: Math.min(p[1], r[1]), z0: Math.min(p[2], r[2]), x1: Math.max(p[0], r[0]), y1: Math.max(p[1], r[1]), z1: Math.max(p[2], r[2]) }; };

/** Where the leaves of each hung door stand open (doors.js plans them; doorleaf.js hangs them once the floor is up): link id → { room, boxes in its frame }. */
function leafBoxes(level) {
  const out = new Map();
  for (const plan of doorPlan(level)) {
    const def = level.rooms[plan.room], dr = def.doors.find((d) => d.link === plan.link);
    if (!dr) continue;
    const wl = WALLS[dr.side], o = wl.o(def.W, def.D), s = wl.s(dr.c, def.W, def.D), half = plan.w / 2, L = half - 0.012;
    const at = (a, b) => [o[0] + wl.U[0] * (s + a) + wl.n[0] * b, o[2] + wl.U[2] * (s + a) + wl.n[2] * b];
    out.set(plan.link, { room: plan.room, boxes: [-1, 1].map((side) => {
      const p = at(side * half, 0), q = at(side * (half + DOORS.thick), L);
      return { x0: Math.min(p[0], q[0]), z0: Math.min(p[1], q[1]), x1: Math.max(p[0], q[0]), z1: Math.max(p[1], q[1]), y0: 0.012, y1: plan.h - 0.015 };
    }) });
  }
  return out;
}

/** (kit.gfx.doorlight) One room's light from next door, baked into its light map. */
function doorLight(world, rt, leaves) {
  const m = rt.lm, def = rt.def;
  if (!m) return;
  const t0 = performance.now(), found = [];
  for (const dr of def.doors) {
    const N = world.rooms[dr.to], th = world.throats.find((t) => t.link.id === dr.link);
    if (!N || !th || !N.lights.length) continue;
    const wl = WALLS[dr.side], n = wl.n, U = wl.U, mid = wallPoint(def, dr.side, dr.c, 0), y0 = dr.sill || 0, y1 = y0 + dr.h;
    const face = (out) => [[-1, y0], [1, y0], [1, y1], [-1, y1]].map(([k, y]) => [mid.x + U[0] * k * dr.w / 2 - n[0] * out, y, mid.z + U[2] * k * dr.w / 2 - n[2] * out]);
    const mv = across(N.def, def), mid3 = [mid.x, y0 + dr.h / 2, mid.z];
    const lamps = N.lights.filter((L) => !L.spill && L.r + L.g + L.b > 1e-6).map((L) => {
      const [x, y, z] = mv(L.x, L.y, L.z), a = mv(L.x + L.ax, L.y, L.z + L.az);
      return { L: { ...L, x, y, z, ax: a[0] - x, az: a[2] - z }, g: groupOf(L, N.lighting), pts: lampPoints(L).map((q) => mv(q[0], q[1], q[2])) };
    });
    const near = (b) => Math.hypot((b.x0 + b.x1) / 2 - mid3[0], (b.z0 + b.z1) / 2 - mid3[2]) < 3.5;
    const leaf = leaves.get(dr.link), boxes = [...(rt.shadowBoxes || []).filter(near), ...(N.shadowBoxes || []).map((b) => boxAcross(mv, b)).filter(near),
      ...(leaf ? leaf.boxes.map((b) => boxAcross(across(world.rooms[leaf.room].def, def), b)) : [])];
    const res = bakeDoorway({ layout: m.layout, faces: [face(0), face(T)], lamps, boxes, skip: dr.side, groups: groupCount(N.lighting) });
    if (!res) continue;
    // each group's colour (its lamps' colour at unit brightness), for the frame to mix by the levels of the room beyond
    const tint = Array.from({ length: res.energy.length }, (_, g) => { const ls = lamps.filter((l) => l.g === g).map((l) => l.L), sum = [0, 0, 0];
      for (const L of ls) { const lum = (L.r + L.g + L.b) / 3; sum[0] += L.r / lum; sum[1] += L.g / lum; sum[2] += L.b / lum; }
      return ls.length ? sum.map((v) => v / ls.length) : [1, 1, 1]; });
    const total = res.energy.reduce((a, b) => a + b, 0);
    found.push({ dr, N, th, res, total, share: [...res.energy].map((e) => e / total), tint });
  }
  found.sort((a, b) => b.total - a.total);
  const kept = found.slice(0, SHADOWS.maxDoors);
  rt.doorStats = { ms: 0, doors: kept.length, of: def.doors.length };
  if (kept.length) {
    const packed = packDoorways(m.layout, kept.map((k) => k.res));
    m.C = packed; m.doors = true;
    m.uniforms.uLmC.value = mapTexture(world.kit, m.layout, packed);
    rt.doorLight = kept.map((k, d) => ({ link: k.dr.link, throat: k.th, other: k.N, peak: k.res.peak, share: k.share, tint: k.tint, u: m.uniforms.uDoorL.value[d] }));
    for (const mat of m.materials) { mat.defines.DOORLIGHT = 1; mat.needsUpdate = true; }
    rt.doorStats.bytes = packed.data.length;
  } else if (!m.shadows) {
    // (nothing came through and nothing is shadowed: the room draws as it did)
    for (const mat of m.materials) { delete mat.defines.LIGHTMAP; mat.needsUpdate = true; }
    rt.lm = null;
  }
  rt.doorStats.ms = Math.round(performance.now() - t0);
}
/** Bytes of a room's light map (shadowmap.js) → a texture the kit owns: read with linear filtering, no mipmaps. */
function mapTexture(kit, layout, q) {
  const t = kit.own(new THREE.DataTexture(q.data, layout.width, layout.height, q.channels === 2 ? THREE.RGFormat : THREE.RGBAFormat));
  t.magFilter = t.minFilter = THREE.LinearFilter; t.generateMipmaps = false; t.unpackAlignment = 1; t.needsUpdate = true;
  return t;
}

/** A voxel model's triangles (batch indices i0…i1) as a few boxes: columns, merged along x where alike. */
function modelColumns(batch, i0, i1, box) {
  const w = box.x1 - box.x0, d = box.z1 - box.z0;
  const nx = clamp(Math.ceil(w / SHADOW_COL), 1, SHADOW_COLS), nz = clamp(Math.ceil(d / SHADOW_COL), 1, SHADOW_COLS), cw = w / nx, cd = d / nz;
  const lo = new Float32Array(nx * nz).fill(Infinity), hi = new Float32Array(nx * nz).fill(-Infinity), p = batch.pos, idx = batch.idx;
  for (let t = i0; t + 2 < i1; t += 3) {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (let k = 0; k < 3; k++) { const v = idx[t + k] * 3, x = p[v], y = p[v + 1], z = p[v + 2]; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; if (z < z0) z0 = z; if (z > z1) z1 = z; }
    const a0 = clamp(Math.floor((x0 - box.x0) / cw + 1e-4), 0, nx - 1), a1 = clamp(Math.ceil((x1 - box.x0) / cw - 1e-4) - 1, a0, nx - 1);
    const b0 = clamp(Math.floor((z0 - box.z0) / cd + 1e-4), 0, nz - 1), b1 = clamp(Math.ceil((z1 - box.z0) / cd - 1e-4) - 1, b0, nz - 1);
    for (let j = b0; j <= b1; j++) for (let i = a0; i <= a1; i++) { const c = j * nx + i; if (y0 < lo[c]) lo[c] = y0; if (y1 > hi[c]) hi[c] = y1; }
  }
  const out = [];
  let filled = 0;
  for (let j = 0; j < nz; j++) {
    let run = null;
    for (let i = 0; i <= nx; i++) {
      const c = j * nx + i, ok = i < nx && hi[c] - lo[c] > 0.02;
      if (ok) filled += hi[c] - lo[c];
      if (run && ok && Math.abs(lo[c] - run.y0) < 0.03 && Math.abs(hi[c] - run.y1) < 0.03) { run.x1 = box.x0 + (i + 1) * cw; run.y0 = Math.min(run.y0, lo[c]); run.y1 = Math.max(run.y1, hi[c]); continue; }
      if (run) out.push(run);
      run = ok ? { x0: box.x0 + i * cw, x1: box.x0 + (i + 1) * cw, z0: box.z0 + j * cd, z1: box.z0 + (j + 1) * cd, y0: lo[c], y1: hi[c] } : null;
    }
  }
  // (nearly solid: the one box is the same shadow for less)
  return !out.length || filled >= 0.85 * nx * nz * (box.y1 - box.y0) ? [{ x0: box.x0, y0: box.y0, z0: box.z0, x1: box.x1, y1: box.y1, z1: box.z1 }] : out;
}

/**
 * The office's furniture catalogue, if it will load (other people are still writing it).
 * Only the recipes are borrowed: each thing is meshed here, for this level, and thrown away with it.
 */
export async function loadCatalogue(kit) {
  try {
    const mod = await import('../props/index.js');
    const PROPS = mod.PROPS || {}, failed = new Set();
    return {
      has: (type) => !!PROPS[type] && !failed.has(type),
      entry: (type) => PROPS[type] || null,
      geo(type, o = {}) {
        const entry = PROPS[type];
        if (!entry || failed.has(type)) return null;
        const spec = { id: `${type}:${o.variant ?? 'backrooms'}`, type, ...o };
        try { return kit.model(`prop:${type}:${entry.variant ? entry.variant(spec) : ''}`, () => entry.make(spec)); }
        catch (err) { failed.add(type); console.warn('[backrooms] prop', type, err); return null; }
      },
    };
  } catch (err) {
    console.warn('[backrooms] no furniture catalogue', err);
    return { has: () => false, entry: () => null, geo: () => null };
  }
}

/**
 * @param kit    from createKit()
 * @param level  from generate()
 * @param env    { catalogue, builders, cast, … } — what rooms may call on
 * @param tick   awaited between rooms, so the loading picture keeps moving
 */
export async function buildWorld(kit, level, env, tick) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  const lightingPlans = planFloorLighting(level, env.lighting);
  const rooms = level.rooms.map((def,i) => ({
    def, id: def.id, group: new THREE.Group(), u: { flick: { value: 1 }, dim: { value: 1 }, banks: { value: [1, 1] }, moreBanks: { value: [0,0] } },
    lighting: lightingPlans[i], bankPanels: [], lightLevels: [1,1],
    lights: [], amb: [0, 0, 0], level: 0, colliders: [], uses: [], zones: [], ticks: [], flickers: [],
    clip: null, floorY: null, headY: null, fold: false, flat: false, onEnter: null,
    rect: { x0: def.x + T / 2, z0: def.z + T / 2, x1: def.x + def.w - T / 2, z1: def.z + def.d - T / 2 },
  }));
  const throats = level.links.map((link) => ({ link, open: !link.door, a: link.a, b: link.b }));
  const world = { scene, level, rooms, throats, kit, env, furniture: [], furnitureColliders: [], movableSurfaces: [],
    furnitureRevision: new Map(rooms.map(rt => [rt.id, 0])) };
  for (const rt of rooms) rt.furnitureRevision = 0;
  /** Invalidate navigation after an explicit collider-state change (e.g. a
   * rejected player step restoring a construction-rescue exception). */
  world.touchFurniture = item => {
    if (!world.furniture.includes(item)) return;
    for (const rt of rooms) if (overlaps(item, rt.rect)) {
      const revision = (world.furnitureRevision.get(rt.id) || 0) + 1;
      world.furnitureRevision.set(rt.id, revision); rt.furnitureRevision = revision;
    }
  };
  const furnitureVisible = () => {
    for (const f of world.furniture) f.group.visible = !f.away && rooms.some(rt => rt.group.visible && overlaps(f, rt.rect));
  };
  world.refreshFurniture = furnitureVisible;
  /** (kit.gfx.doorlight) Each doorway's light this frame: how open it is × how lit the room beyond is, in its colours. */
  const refreshDoorLight = (rt) => {
    for (const d of rt.doorLight) {
      const door = env.doors?.at?.(d.link), open = door ? 1 - door.k : d.throat.open ? 1 : 0, N = d.other, lv = N.lightLevels || [];
      let r = 0, g = 0, b = 0;
      for (let k = 0; k < d.share.length; k++) {
        const level = k === 0 ? 1 : k === 1 ? N.u.flick.value : (N.lighting ? lv[k - 2] ?? 1 : 1), w = d.share[k] * level;
        r += w * d.tint[k][0]; g += w * d.tint[k][1]; b += w * d.tint[k][2];
      }
      // (baked late: it comes up over DOOR_FADE seconds from the first frame it is drawn, not all at once)
      if (d.late && d.since === undefined) d.since = lightingTime;
      const k = d.peak * open * N.u.dim.value * DOOR_GAIN * (d.late ? Math.min(1, (lightingTime - d.since) / DOOR_FADE) : 1);
      d.u.set(r * k, g * k, b * k);
    }
  };
  world.refreshDoorLight = refreshDoorLight;
  let lightingTime = 0;
  const refreshBanks = (rt) => {
    if (!rt.lighting) return;
    rt.lightLevels = bankLevels(rt.lighting, lightingTime, rt.lightsK ?? 1, !!env.steadyLighting?.());
    rt.u.banks.value = rt.lightLevels.slice(0,2);
    rt.u.moreBanks.value = [rt.lightLevels[2] ?? 0, rt.lightLevels[3] ?? 0];
    for (const mesh of rt.bankPanels) mesh.material.color.copy(mesh.userData.on)
      .multiplyScalar(Math.max(0.001, rt.lightLevels[mesh.userData.bank]) * Math.max(0.02, rt.lightsK ?? 1));
  };

  /* ---- how bright each room is, before anything is built ------------------------- */
  for (const rt of rooms) {
    const { def } = rt, tube = lin(def.look.tube), wall = lin(def.look.wall), top = Math.max(...wall);
    const lit = def.panels.filter((p) => p.state !== 'dead').length;
    rt.level = 0.03 + Math.min(0.4, (2.5 * lit * def.light.power) / (def.W * def.D));
    rt.amb = tube.map((c, i) => c * rt.level * (0.55 + 0.45 * wall[i] / top));
    rt.group.position.set(def.cx, def.y || 0, def.cz);
    rt.group.rotation.y = (def.rot * Math.PI) / 2;
    scene.add(rt.group);
  }

  /* ---- can a body stand here? ------------------------------------------------------ */
  const hits = (c, x, z, r) => {
    if (c.on === false) return false;
    if (c.r !== undefined) return (x - c.x) ** 2 + (z - c.z) ** 2 < (r + c.r) ** 2;
    const dx = x - Math.max(c.x0, Math.min(x, c.x1)), dz = z - Math.max(c.z0, Math.min(z, c.z1));
    return dx * dx + dz * dz < r * r;
  };
  world.inThroat = (x, z, r) => {
    for (const th of throats) {
      if (!th.open) continue;
      const l = th.link, reach = T / 2 + r + 0.06;
      if (l.axis === 'x' ? (Math.abs(x - l.at) <= reach && z >= l.from + r && z <= l.to - r) : (Math.abs(z - l.at) <= reach && x >= l.from + r && x <= l.to - r)) return true;
    }
    return false;
  };
  const inWindow = (x, z) => level.windows.some((w) => (w.axis === 'x' ? Math.abs(x - w.at) <= T / 2 + 0.03 && z >= w.from && z <= w.to : Math.abs(z - w.at) <= T / 2 + 0.03 && x >= w.from && x <= w.to));
  const ignored = (value, object) => value === object || value?.has?.(object);
  const insideAt = (x, z, r, opt) => {
    let inside = false;
    for (const rt of rooms) {
      const b = rt.rect;
      if (x < b.x0 + r || x > b.x1 - r || z < b.z0 + r || z > b.z1 - r) continue;
      const p = toLocal(rt.def, x, z);
      if (rt.clip ? !rt.clip(p.x, p.z, r) : !fitsAt(rt.def, p.x, p.z, r)) continue;
      inside = true; break;
    }
    return inside || world.inThroat(x, z, r) || (opt.tall && inWindow(x, z));
  };
  /** Clear of walls, furniture and bodies. bounds supplies an exact AABB footprint;
   * ignoreCollider/ignoreBody are identity-based exceptions for the body being moved.
   * furniture:'phase' is for apparitions; furnitureY is a flyer's absolute bottom.
   * Neither permission bypasses walls, closed doors or the room footprint. */
  world.free = (x, z, r = 0.22, opt = {}) => {
    const box = opt.bounds;
    if (box) {
      if (![box.x0, box.z0, box.x1, box.z1].every(Number.isFinite) || box.x1 <= box.x0 || box.z1 <= box.z0) return false;
      const nx = Math.max(1, Math.ceil((box.x1 - box.x0) / .15)), nz = Math.max(1, Math.ceil((box.z1 - box.z0) / .15));
      for (let ix = 0; ix <= nx; ix++) for (let iz = 0; iz <= nz; iz++) {
        if (!insideAt(box.x0 + (box.x1 - box.x0) * ix / nx, box.z0 + (box.z1 - box.z0) * iz / nz, .001, opt)) return false;
      }
    } else if (!insideAt(x, z, r, opt)) return false;
    const blocked = c => c.on !== false && !ignored(opt.ignoreCollider, c)
      && !(c.floor && !box)
      && !(c.furniture && opt.furniture === 'phase')
      && !(Number.isFinite(opt.furnitureY) && Number.isFinite(c.top) && opt.furnitureY >= c.top)
      && (!opt.tall || c.tall) && (box ? boxHits(box, c) : hits(c, x, z, r));
    // Grid construction may supply a room-local snapshot for this synchronous query.
    // Actual body movement omits the hint and always tests the current complete set.
    for (const c of opt.furnitureColliders || world.furnitureColliders) if (blocked(c)) return false;
    for (const rt of rooms) {
      const b = rt.rect;
      if (box ? !overlaps(box, { x0: b.x0 - 1, z0: b.z0 - 1, x1: b.x1 + 1, z1: b.z1 + 1 }) : x < b.x0 - 1 || x > b.x1 + 1 || z < b.z0 - 1 || z > b.z1 + 1) continue;
      for (const c of rt.colliders) if (!c.furniture && blocked(c)) return false;
    }
    // …and whatever is standing about that has a body (pursuer.js). They only ever move while nobody is looking.
    if (!opt.tall && !opt.ghost) for (const b of world.bodies) if (b.on !== false && !ignored(opt.ignoreBody, b)
      && (!b.airborne || box)
      && !(box && Number.isFinite(opt.top) && Number.isFinite(b.bottom) && opt.top <= b.bottom)
      && !(box && Number.isFinite(opt.bottom) && Number.isFinite(b.top) && opt.bottom >= b.top) && (box ? boxHits(box, b) : (x - b.x) * (x - b.x) + (z - b.z) * (z - b.z) < (r + b.r) * (r + b.r))) return false;
    return true;
  };
  /** Things with a body that are not part of any room: [{ x, z, r }], kept up to date by whoever owns them. */
  world.bodies = [];
  world.roomAt = (x, z) => {
    for (const rt of rooms) { const d = rt.def; if (x >= d.x && x < d.x + d.w && z >= d.z && z < d.z + d.d) return rt; }
    return null;
  };
  /** Height of the floor here, in the world. */
  world.terrainY = (x, z) => {
    const rt = world.roomAt(x, z);
    if (!rt) return 0;
    if (rt.flat) return rt.def.y;
    const p = toLocal(rt.def, x, z);
    return rt.def.y + (rt.floorY ? rt.floorY(p.x, p.z) : floorAt(rt.def, p.x, p.z));
  };
  world.floorY = (x, z) => surfaceAt(world.movableSurfaces, x, z, world.terrainY(x, z));
  /** How much room there is to stand up in here. */
  world.ceilingY = (x, z) => {
    const rt = world.roomAt(x, z);
    if (!rt || rt.flat) return world.terrainY(x, z) + 9;
    const p = toLocal(rt.def, x, z);
    const terrain = world.terrainY(x, z), localFloor = terrain - (rt.def.y || 0);
    // Crawl openings still cap clearance when the walking surface is a bridge.
    return terrain + headAt(rt.def, p.x, p.z, rt.headY ? rt.headY(p.x, p.z) : ceilAt(rt.def, p.x, p.z) - localFloor);
  };
  world.headroom = (x, z) => world.ceilingY(x, z) - world.floorY(x, z);
  /** May a walker go from one spot to the next? The floor may not jump by more than a stair, and there must be room to crawl. */
  world.passable = (x0, z0, x1, z1) => {
    if (world.headroom(x1, z1) < HEAD) return false;
    if (Math.abs(world.floorY(x1, z1) - world.floorY(x0, z0)) <= STEP) return true;
    return !!(world.roomAt(x1, z1)?.fold && world.roomAt(x0, z0)?.fold);            // rooms that fold space keep their own counsel
  };
  /** Can one point see another? Walls and tall furniture block; chairs, doorways and windows do not. */
  world.los = (ax, az, bx, bz) => {
    const len = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.ceil(len / 0.2));                      // (a wall is 0.2 m: a longer step can miss one)
    for (let i = 1; i < n; i++) { const t = i / n; if (!world.free(ax + (bx - ax) * t, az + (bz - az) * t, 0.02, { tall: true })) return false; }
    return true;
  };
  world.openLink = (id) => { throats[id].open = true; };
  world.path = (a, b) => roomPath(level, a, b);
  /** The middle of the doorway between two neighbouring rooms, in the world. */
  world.doorway = (a, b) => {
    const th = throats.find((t) => (t.a === a && t.b === b) || (t.a === b && t.b === a));
    if (!th) return null;
    const l = th.link, mid = (l.from + l.to) / 2;
    return l.axis === 'x' ? { x: l.at, z: mid, open: th.open, nx: 1, nz: 0 } : { x: mid, z: l.at, open: th.open, nx: 0, nz: 1 };
  };
  // what can be seen from where: through doorways, and through windows
  const sight = rooms.map((rt) => [...new Set([...rt.def.doors.map((d) => d.to), ...(rt.def.wins || []).map((w) => w.to)])]);
  world.distances = (from) => {
    const dist = new Map([[from, 0]]), queue = [from];
    while (queue.length) { const cur = queue.shift(); for (const n of sight[cur]) if (!dist.has(n)) { dist.set(n, dist.get(cur) + 1); queue.push(n); } }
    return dist;
  };
  /**
   * One room's floor the way the player walks it, on a 12.5 cm grid in the room's own frame: where a body fits (free),
   * how high the floor is there, and everything that can be reached on foot from just inside a set of its doorways
   * (flood → one byte per cell; key(point) is a point's cell, at(k) the middle of cell k).
   */
  world.walkable = (rt, view = world) => {
    const { def } = rt, cell = 0.125, r = 0.225, nx = Math.ceil(def.W / cell), nz = Math.ceil(def.D / cell);
    const key = (p) => Math.floor((p.x + def.W / 2) / cell) + nx * Math.floor((p.z + def.D / 2) / cell);
    const at = (k) => { const i = k % nx; return { x: -def.W / 2 + (i + 0.5) * cell, z: -def.D / 2 + ((k - i) / nx + 0.5) * cell }; };
    // Keep this per-room grid cheap: no search through every room or every
    // chair at every cell. Proof copies provide their own surface collection.
    const surfaces = view.movableSurfaces.filter(f => overlaps(f, rt.rect));
    const terrain = (x, z) => rt.flat ? 0 : rt.floorY ? rt.floorY(x, z) : floorAt(def, x, z);
    const floor = (x, z) => {
      const y = terrain(x, z); if (!surfaces.length) return y;
      const p = toWorld(def, x, z); return surfaceAt(surfaces, p.x, p.z, y + (def.y || 0)) - (def.y || 0);
    };
    const head = (x, z) => (rt.flat ? 9 : headAt(def, x, z, rt.headY ? rt.headY(x, z) : ceilAt(def, x, z) - terrain(x, z))) - (floor(x, z) - terrain(x, z));
    // Include a neighbouring room's desk when it straddles this doorway, without
    // testing every distant movable object at every cell in this room's flood.
    const nearbyFurniture = view.furnitureColliders.filter(c => overlaps(c, rt.rect, -r));
    const local = [...new Set([...rt.colliders.filter(c => !c.furniture), ...nearbyFurniture])].map((c) => { const a = toLocal(def, c.x0, c.z0), b = toLocal(def, c.x1, c.z1); return { c, x0: Math.min(a.x, b.x), z0: Math.min(a.z, b.z), x1: Math.max(a.x, b.x), z1: Math.max(a.z, b.z) }; });
    const free = (x, z) => Math.abs(x) <= def.W / 2 - r && Math.abs(z) <= def.D / 2 - r && (rt.clip ? rt.clip(x, z, r) : fitsAt(def, x, z, r)) && head(x, z) >= HEAD
      && !local.some((q) => { if (q.c.on === false || q.c.floor) return false; const dx = x - clamp(x, q.x0, q.x1), dz = z - clamp(z, q.z0, q.z1); return dx * dx + dz * dz < r * r; });
    const flood = (doors) => {
      const seen = new Uint8Array(nx * nz), queue = [];
      for (const dr of doors) { const k = key(wallPoint(def, dr.side, dr.c, 0.5)); if (!seen[k]) { seen[k] = 1; queue.push(k); } }          // half a metre in: clear of a door that is still shut
      while (queue.length) {
        const k = queue.pop(), i = k % nx, j = (k - i) / nx, hx = -def.W / 2 + (i + 0.5) * cell, hz = -def.D / 2 + (j + 0.5) * cell, hy = floor(hx, hz);
        for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const ii = i + di, jj = j + dj, kk = ii + nx * jj;
          if (ii < 0 || jj < 0 || ii >= nx || jj >= nz || seen[kk]) continue;
          const tx = hx + di * cell, tz = hz + dj * cell;
          if (!free(tx, tz) || (!rt.fold && Math.abs(floor(tx, tz) - hy) > STEP)) continue;
          seen[kk] = 1; queue.push(kk);
        }
      }
      return seen;
    };
    return { cell, nx, nz, key, at, free, floor, head, flood };
  };

  /* ---- build ---------------------------------------------------------------------- */
  world.timing = [];                           // [what, milliseconds] — where the loading time went
  for (const rt of rooms) {
    const t0 = performance.now();
    const builder = env.builders[rt.def.kind === 'special' ? rt.def.arch : rt.def.kind] || env.builders.plain;
    let ctx = roomContext(world, rt);
    try { builder(ctx); }
    catch (err) {
      if (env.coopStrict) throw err;
      console.warn(`[backrooms] ${rt.def.arch || rt.def.kind} would not build — leaving it plain`, err);
      for (const f of [...world.furniture]) if (f.authored && f.room === rt.id) f.remove();
      rt.bridgePlans = [];
      rt.group.clear(); rt.colliders.length = 0; rt.uses.length = 0; rt.zones.length = 0; rt.ticks.length = 0; rt.flickers.length = 0; rt.lights.length = 0;
      rt.clip = null; rt.floorY = null; rt.headY = null; rt.fold = false;
      ctx = roomContext(world, rt); ctx.shell();
    }
    emergencyFixtures(ctx);
    env.stash?.(ctx);                          // what is hidden in this room, if anything (loot.js): last, so the furniture is where it always was and the coin can see what floor is left
    const t1 = performance.now();
    let baked = 0;
    // (kit.gfx.shadows, .doorlight) the room's light map in a slice of its own, with a breath before and after it, so a
    // frame pays the room's build, its map or its bake but never two of them. tick's third argument asks for a short
    // breath: the three are short, so a room still takes the breaths it took before, only spread over its pieces
    const sliced = !!tick && !!kit.gfx && (kit.gfx.shadows > 0 || kit.gfx.doorlight > 0);
    if (sliced) {
      await tick(rt.id, rooms.length, true);
      const s0 = performance.now(); ctx.shade(); baked += performance.now() - s0;
      await tick(rt.id, rooms.length, true);
    }
    const t2 = performance.now();
    ctx.finish();
    refreshBanks(rt);
    world.timing.push([`${rt.def.arch || rt.def.kind}#${rt.id}`, Math.round(t1 - t0), Math.round(baked + performance.now() - t2)]);
    if (tick) await tick(rt.id + 1, rooms.length, sliced);
  }
  // (kit.gfx.doorlight) the light through the doorways, now that every room's lamps are known
  const lateDoors = kit.gfx?.doorlight > 0 && !!env.lateDoorLight && !!tick;
  if (kit.gfx?.doorlight > 0 && !lateDoors) await doorPass(world, tick);
  const tCheck = performance.now();

  // nothing may wall a doorway off. Walk every room the way the player would; if a doorway cannot be reached,
  // first its furniture stops being solid, and if that is not enough its floor is treated as flat.
  for (const rt of rooms) {
    const { def } = rt;
    if (def.doors.length < 2 || (!rt.colliders.length && !def.shape && !rt.clip && !rt.floorY && def.doors.every((d) => !(d.sill > 0.01)))) continue;
    const walk = world.walkable(rt);
    const reaches = () => { const seen = walk.flood([def.doors[0]]); return def.doors.every((dr) => seen[walk.key(wallPoint(def, dr.side, dr.c, 0.5))]); };
    if (reaches()) continue;
    if (bridgeReachable(world, rt)) { rt.bridgePuzzleVerified = true; continue; }
    console.warn(`[backrooms] a doorway of ${def.arch || def.kind} #${def.id} could not be reached — its furniture is no longer solid`);
    for (const c of rt.colliders) if (!c.keep) c.on = false;
    if (!reaches()) { for (const c of rt.colliders) c.on = false; rt.flat = true; rt.clip = () => true; console.warn(`[backrooms] …nor even then: room #${def.id} is now flat and empty to walk in`); }
    if (tick) await tick(rooms.length, rooms.length);
  }

  world.timing.push(['no-trap check', Math.round(performance.now() - tCheck), 0]);

  /* ---- while you play ------------------------------------------------------------- */
  let current = null;
  world.current = () => current;
  /** Which rooms are drawn and which are alive, given where the player is. */
  world.enter = (rt) => {
    if (!rt || rt === current) return;
    const before = current;
    current = rt;
    const dist = world.distances(rt.id);
    for (const r of rooms) { const d = dist.get(r.id); r.group.visible = d <= 3; r.near = d <= 1; }
    furnitureVisible();
    before?.onLeave?.();
    rt.visits = (rt.visits || 0) + 1;
    rt.onEnter?.(rt.visits);
  };
  /** Before anybody is in this part: draw what is round a spot (the place they will come down), so that it can be seen from above. */
  world.glimpse = (x, z, reach) => {
    const at = world.roomAt(x, z), dist = at ? world.distances(at.id) : new Map();
    for (const r of rooms) r.group.visible = (dist.get(r.id) ?? 99) <= 3 || Math.hypot(r.def.cx - x, r.def.cz - z) <= reach;
    furnitureVisible();
  };
  // Also used for the visible part below/above a way down. Its lighting can
  // run without waking its creatures, hazards or room-entry callbacks.
  /** Authored encounter hook: existing corridor banks go out from one end.
   * Local low/high follows the plan's axis. Hold leaves them out until cleared. */
  world.startLightingCue = (rt, {from = 'low', hold = true} = {}) => {
    if (rt?.lighting?.kind !== 'travel' || !rooms.includes(rt)) return false;
    rt.lighting.cue = {start:lightingTime, hold, reverse:from === 'low' ? rt.lighting.reverse : !rt.lighting.reverse};
    return true;
  };
  world.clearLightingCue = rt => { if (rooms.includes(rt) && rt.lighting) delete rt.lighting.cue; };
  world.updateLighting = (t) => {
    lightingTime = t; world.litAt = performance.now();
    world.lightingTime = t;
    for (const rt of rooms) refreshBanks(rt);
    for (const rt of rooms) if (rt.doorLight) refreshDoorLight(rt);
    if ((env.lighting || world.hasLighting) && world.lightAt) for (const f of world.furniture) {
      if (!f.lightTint || !f.group.visible || f.away) continue;
      const rt = world.roomAt(f.x, f.z);
      f.lightTint.fromArray(world.lightAt(f.x, f.z, (f.y + f.top) / 2 - (rt?.def.y || 0)));
    }
  };
  world.updateFlicker = (dt) => {for(const rt of rooms){
      // tubes that cannot make their minds up
      if (rt.flickers.length && rt.group.visible) {
        rt.phase = (rt.phase ?? rt.id * 7.3) + dt;
        const p = rt.phase;
        let k = 1;
        const slow = Math.sin(p * 1.7) + Math.sin(p * 2.9 + 1.3);
        if (env.steadyLighting?.()) k = 1;
        else if (slow > 1.15) k = Math.random() < 0.5 ? 0.15 : 0.9;
        else if (Math.random() < 0.012) k = 0.3;
        rt.flickerNow = k;
        rt.u.flick.value += (k - rt.u.flick.value) * 0.6;
        for (const f of rt.flickers) f.material.color.copy(f.userData.on).multiplyScalar((0.12 + 0.88 * rt.u.flick.value) * (rt.lightsK ?? 1));
      }
  }};
  world.update = (dt, t, me) => {
    if (!me.frozen) for (const f of world.furniture) f.tick?.(dt);
    world.updateLighting(t);world.updateFlicker(dt);
    const here = world.roomAt(me.x, me.z);
    if (here) world.enter(here);
    for (const rt of rooms) {
      if (!rt.near) continue;
      const p = toLocal(rt.def, me.x, me.z);
      const local = { x: p.x, z: p.z, inside: rt === current, yaw: me.yaw - (rt.def.rot * Math.PI) / 2, moving: me.moving, speed: me.speed, world: me };
      for (const zone of rt.zones) {
        const inZone = rt === current && p.x >= zone.x0 && p.x <= zone.x1 && p.z >= zone.z0 && p.z <= zone.z1;
        if (inZone && !zone.in) { zone.in = true; zone.enter?.(local); }
        else if (!inZone && zone.in) { zone.in = false; zone.leave?.(local); }
        if (inZone) zone.stay?.(dt, local);
      }
      for (const fn of rt.ticks) fn(dt, t, local);
    }
  };
  /** The nearest usable thing the player is facing, or null. */
  world.usable = (me) => {
    let best = null, bestScore = Infinity, item = null, itemScore = Infinity;
    const fx = -Math.sin(me.yaw), fz = -Math.cos(me.yaw);
    for (const rt of rooms) {
      if (!rt.near) continue;
      for (const use of rt.uses) {
        if (use.furniture?.away) continue;
        if (use.when && !use.when()) continue;
        const dx = use.wx - me.x, dz = use.wz - me.z, d = Math.hypot(dx, dz);
        if (d > use.r) continue;
        const facing = d < 0.45 ? 1 : (dx * fx + dz * fz) / d;
        if (facing < (use.cone ?? 0.55)) continue;
        const score = d * (1.6 - facing);
        if (score >= bestScore && !(use.inventoryItem && score < itemScore)) continue;
        if (!(d < 0.6 || world.los(me.x, me.z, use.wx - (dx / d) * 0.3, use.wz - (dz / d) * 0.3))) continue;
        if (score < bestScore) { best = use; bestScore = score; }
        if (use.inventoryItem && score < itemScore) { item = use; itemScore = score; }
      }
    }
    return chooseUse(best, item);                         // (something to pick up in a doorway is taken before the door is worked: use.rule.js)
  };
  /** Turn a room's ceiling up or down (0 = out, 1 = as built): the tubes, and everything they light. */
  world.setLights = (rt, k) => {
    rt.lightsK = k; rt.u.dim.value = Math.max(0.03, k);
    if (rt.panelMesh) rt.panelMesh.material.color.copy(rt.panelOn).multiplyScalar(Math.max(0.02, k));
    refreshBanks(rt);
  };
  /** The light falling on a spot of the world (for things that wander between rooms). */
  world.lightAt = (x, z, y = 1) => {
    const rt = world.roomAt(x, z);
    if (!rt) return [0.2, 0.2, 0.2];
    const p = toLocal(rt.def, x, z), k = rt.u.dim.value;
    return lightAt(rt.lights, rt.amb, p.x, y, p.z, 0, 1, 0,
      { lighting: rt.lighting, banks: rt.lightLevels, flick: rt.u.flick.value, ...(rt.lm?.shadows ? { shade: world.shadeAt(rt, p.x, p.z) } : {}) }).map((v, c) => v * k + (rt.doorLight ? world.doorAt(rt, p.x, p.z)[c] : 0));
  };
  /** (kit.gfx.doorlight) The light from next door on the floor here, for a body standing on it (as the shade, at 75 %). */
  world.doorAt = (rt, x, z) => {
    const m = rt.lm, out = [0, 0, 0], v = m?.C ? sampleMap(m.layout, m.C.data, 4, rt.def.W, rt.def.D, x, 0, z) : null;
    if (v) rt.doorLight.forEach((d, i) => { const s = v[i] * v[i] * SHADE_BODY; out[0] += s * d.u.x; out[1] += s * d.u.y; out[2] += s * d.u.z; });
    return out;
  };
  /** (kit.gfx.shadows) How much of each group's light reaches the floor here past what stands in the room, for a body
   * standing on it: most of the floor's own share (a body's head can be clear of a shadow its feet are in). */
  world.shadeAt = (rt, x, z) => {
    const m = rt.lm; if (!m?.shadows) return undefined;
    const a = sampleMap(m.layout, m.A.data, m.A.channels, rt.def.W, rt.def.D, x, 0, z), b = m.B ? sampleMap(m.layout, m.B.data, 2, rt.def.W, rt.def.D, x, 0, z) : null;
    if (!a) return undefined;
    return [...a, ...(b || [])].map((v) => 1 - SHADE_BODY * (1 - v));
  };
  /** Exposure/hum follow the bank above the camera, rather than the whole room's average. */
  world.illuminationAt = (x, z) => {
    const rt = world.roomAt(x, z);
    if (!rt) return 0.3;
    const p = toLocal(rt.def, x, z);
    return rt.level * rt.u.dim.value * (rt.lighting ? localLightScale(rt.lighting, rt.lights, rt.lightLevels, p.x, p.z) : 1);
  };
  world.dispose = () => { world.disposed = true; scene.traverse((o) => { if (o.userData.dispose) o.userData.dispose(); }); scene.clear(); };
  world.hasLighting = rooms.some(rt => !!rt.lighting);
  world.updateLighting(0);
  // (env.lateDoorLight) the part is ready without the light through its doorways; it fills in a room at a time, the
  // rooms round the landing first, each arriving whole and fading up. It stops when the part is thrown away.
  world.doorsLit = lateDoors ? doorPass(world, tick, true) : null;
  return world;
}

/** (kit.gfx.doorlight) Every room's light from next door, a room at a time, `tick` awaited between rooms. Late: after the
 * part is ready, nearest the landing first; whatever is baked late fades up (refreshDoorLight), and a part thrown away
 * (world.dispose) is not touched again. */
async function doorPass(world, tick, late = false) {
  const { rooms, level } = world, t0 = performance.now(), leaves = leafBoxes(level);
  let order = rooms;
  if (late) {
    world.doorsPending = true;
    const at = world.roomAt(level.start.x, level.start.z), dist = at ? world.distances(at.id) : new Map();
    order = [...rooms].sort((a, b) => (dist.get(a.id) ?? 99) - (dist.get(b.id) ?? 99) || a.id - b.id);
  }
  // (a room at a time, the loading picture kept moving between them: the part below is built while somebody walks; a
  // room's doorways are a few tens of milliseconds at most, so a short breath between rooms)
  for (const rt of order) {
    if (late) { if (tick) await tick(rooms.length, rooms.length, true); if (world.disposed) return; }
    doorLight(world, rt, leaves);
    if (late && rt.doorLight) {
      // (the part lit frame by frame, being played in: it fades up; hung below unlit, or not yet looked at: at once, as
      // it would have been had it been baked before the part was ready)
      const live = world.lightingTime > 0 && performance.now() - world.litAt < 250;
      for (const d of rt.doorLight) d.late = live;
      world.refreshDoorLight(rt);
    }
    if (!late && tick) await tick(rooms.length, rooms.length, true);
  }
  world.doorsPending = false;
  world.timing.push(['door light', Math.round(performance.now() - t0), Math.max(0, ...rooms.map((rt) => rt.doorStats?.ms || 0))]);
}

/* ---- the toolbox a room is built with ------------------------------------------------ */

/** What the level puts down for c.prop(type) in place of the office's: { geo, scale, over? } (over: detail laid on it at
 * the same place), or null where the office's own is drawn. o is the layout object the office's would have been made for. */
function levelProp(kit, catalogue, type, o = {}) {
  const ws = WORKSTATION.scale, model = (key, make) => kit.model(key, make, { ao: false });
  if (type === 'desk') return { geo: model('level:desk', deskVox), scale: LEVEL_DESK.scale };
  // (the office's chair is made in o.color, or its own blue where there is none; its mesh is shared by colour)
  if (type === 'chair') return { geo: model(`level:chair:${o.color || ''}`, () => chairVox({ colour: o.color || undefined })), scale: ws };
  if (type === 'crt') return { geo: model('level:crt', crtVox), scale: ws };
  if (type === 'keyboard') return { geo: model('level:keyboard', keyboardVox), scale: ws, over: model('level:keyboard:keys', keyboardKeysVox) };
  if (type === 'cabinet') return { geo: model('level:cabinet', cabinetVox), scale: STORAGE.scale };
  if (type === 'boxes') {
    // (the office picks one of its three stacks by the layout object, as catalogue.geo makes it: the same pick, the same stack)
    const entry = catalogue.entry?.(type), n = Number(entry?.variant?.({ id: `${type}:${o.variant ?? 'backrooms'}`, type, ...o }) || 0);
    return { geo: model(`level:boxes:${n}`, () => boxesVox(n)), scale: STORAGE.scale };
  }
  // (the office's bin is always one colour, whatever o.color a room hands it (the museum does): so is this one, in the teal
  // the office's is, binVox's own default: the swap is of the model, not of its colour)
  if (type === 'bin') return { geo: model('level:bin', binVox), scale: SMALLS.scale };
  if (type === 'trolley') return { geo: model('level:trolley', trolleyVox), scale: SMALLS.scale };
  // (the water cooler's bottle and cup tube are glass: c.place puts them into the room's glass batch, as it does the office's,
  // and tint, noGlow and shadow act on it as on the office's; its only glow is the two tap lights)
  if (type === 'cooler') return { geo: model('level:cooler', coolerVox), scale: SMALLS.scale };
  return null;
}

function roomContext(world, rt) {
  const { kit, env, level } = world, { def } = rt, { W, D } = def, H = def.H, look = def.look;
  const R = makeRng(`${level.seed}/build/${def.id}`);
  const mapped = new Map(), shining = new Map(), voxed = new Map();
  /**
   * (the shell's own, not the rooms': kit.gfx.fixtures) a voxel batch besides c.vox, baked and drawn as c.vox is.
   * opt.detail marks its mesh as detail (as c.detail does for boxes: hidden at a low Graphics setting); opt.structural
   * keeps it the room's own, never carried off with furniture that can be dragged; opt.uncarried: what of it would be
   * carried off is left out instead (it would be a mesh of its own on each thing that carries some). (A key's options are its first ones.)
   */
  const voxBatch = (key, opt = {}) => {
    if (!voxed.has(key)) { const b = track(new Batch(true), !!opt.structural); if (opt.detail) b.detail = true; if (opt.uncarried) b.uncarried = true; voxed.set(key, b); }
    return voxed.get(key);
  };
  /** A sculpted wall fitting (wallfit.model.js) on the wall at p (c.wallAt, 0 off it), its origin at height y, into a
   * batch the room already has (c.flat, at a white spot of its texture, for what has nothing that shines; else c.vox),
   * so that its sockets and signs cost it no mesh apiece. Nothing of it is solid, and it is not gathered as standing
   * by itself (an exit sign says for its box what the plain one stood as). */
  const wallFit = (geo, p, y, into, opt) => {
    const s = WALLFIT.voxel;
    mat.set(p.U[0] * s, 0, p.n[0] * s, p.x, 0, s, 0, y, p.U[2] * s, 0, p.n[2] * s, p.z, 0, 0, 0, 1);
    into.addVox(geo.solid, mat, opt);
  };
  const reserved = [], kept = [];                         // floor already spoken for: [x, z, radius] · and wall: [side, from, to]
  const mat = new THREE.Matrix4(), quat = new THREE.Quaternion(), eul = new THREE.Euler(), vec = new THREE.Vector3(), scl = new THREE.Vector3();
  const doorPoint = (dr, off = 0) => wallPoint(def, dr.side, dr.c, off);
  const stairs = stairZones(def, 0.7);
  const moving = env.barricadesEnabled === true, placements = [], batches = new Map(), decalChunks = [], added = [];
  let placing = null;
  // (kit.gfx only) what stands in the room, for contact darkening: every box drawn into the room's own batches, every model, every pillar
  const gfxOn = kit.gfx?.contact > 0 || kit.gfx?.shadows > 0 || kit.gfx?.doorlight > 0, standing = [];
  const shadowsOn = kit.gfx?.shadows > 0, doorOn = kit.gfx?.doorlight > 0, mapOn = shadowsOn || doorOn;
  let gfxShell = null, shaded = null;
  const noteBoxes = (batch, structural) => {
    const original = batch.box;
    batch.box = function (x0, y0, z0, x1, y1, z1, ...rest) {
      standing.push({ x0: Math.min(x0, x1), y0: Math.min(y0, y1), z0: Math.min(z0, z1), x1: Math.max(x0, x1), y1: Math.max(y0, y1), z1: Math.max(z0, z1), placing, structural });
      return original.call(this, x0, y0, z0, x1, y1, z1, ...rest);
    };
  };
  const ownBatch = (batch) => batch === c.vox || [...mapped.values()].some((m) => m.batch === batch);
  /** (kit.gfx) Once the room is built and its furniture sorted: what darkens what, and the colours that bounce. */
  const gfxRoom = () => {
    const ground = (x, z) => (rt.flat ? 0 : rt.floorY ? rt.floorY(x, z) : floorAt(def, x, z));
    const ownerOf = (s) => (!moving ? null : s.placing ? s.placing.owner || null : s.structural ? null
      : furnitureGroups.find((f) => f.type !== 'chair' && onFurniture(f.placement.foot, { x0: s.x0, z0: s.z0, x1: s.x1, z1: s.z1, bottom: s.y0, top: s.y1 })) || null);
    // only what stands on the floor (or on something that does), big enough to matter, and not anything that can be dragged about
    const fit = standing.filter((s) => {
      const w = s.x1 - s.x0, d = s.z1 - s.z0, h = s.y1 - s.y0;
      return h >= 0.15 && Math.max(w, d) >= 0.1 && Math.min(w, d) >= 0.015 && w * d <= 0.4 * W * D && !ownerOf(s);
    });
    const grounded = fit.filter((s) => s.y0 <= ground((s.x0 + s.x1) / 2, (s.z0 + s.z1) / 2) + 0.06);
    const stacked = fit.filter((s) => !grounded.includes(s) && grounded.some((b) => overlaps(s, b) && Math.abs(s.y0 - b.y1) < 0.08));
    const occluders = [...grounded, ...stacked].map((s) => ({ ...s, R: clamp(0.25 + 0.5 * Math.min(s.y1 - s.y0, Math.max(s.x1 - s.x0, s.z1 - s.z0)), 0.25, 0.75) }));
    // what can be dragged keeps its round blot, a little darker, since the floor round it is not darkened for it
    if (kit.gfx.contact > 0) for (const f of furnitureGroups) for (let i = 3; i < f.decals.col.length; i += 4) f.decals.col[i] = Math.min(0.8, f.decals.col[i] * (1 + 0.6 * kit.gfx.contact));
    const mul = (a, b) => a.map((v, i) => v * b[i]);
    const room = { near: occluders.length ? occluderGrid(occluders) : null, floorAt: ground, W, D, sides: gfxShell?.sides || new Set(),
      floorRgb: gfxShell?.fAlb && mapped.get('floor')?.batch.verts ? mul(lin(look.carpet), gfxShell.fAlb) : null,
      wallRgb: gfxShell?.wAlb && mapped.get('wall')?.batch.verts ? mul(lin(look.wall), gfxShell.wAlb) : null };
    room.moving = { ...room, near: null };
    return room;
  };
  const track = (batch, structural = false) => {
    if (!moving || batches.has(batch)) return batch;
    const entry = { batch, chunks: [], structural }; batches.set(batch, entry);
    let depth = 0;
    for (const name of ['grid', 'quad', 'tri', 'ball', 'box', 'addVox']) {
      const original = batch[name];
      batch[name] = function (...args) {
        const start = this.verts, first = this.idx.length, outer = depth++ === 0;
        try { return original.apply(this, args); }
        finally {
          depth--;
          if (outer && this.verts > start) entry.chunks.push({ start, end: this.verts, first, last: this.idx.length, placement: placing });
        }
      };
    }
    return batch;
  };
  /** (kit.gfx.shadows, .doorlight) The room's light map: what stands in it, the floor and walls it falls on, the tubes'
   * shadows baked (shadowmap.js). The light through its doorways is added once every room is built (doorLight, below). */
  function shadowRoom() {
    const t0 = performance.now();
    // (a floor that is not one flat rectangle at the room's level keeps the light it has: no floor in the map)
    const floorOk = !!(gfxShell?.fAlb && mapped.get('floor')?.batch.verts) && !rt.floorY && !rt.flat && !(def.shape && (def.shape.kind === 'pit' || def.shape.kind === 'dais'));
    const walls = gfxShell?.wAlb && mapped.get('wall')?.batch.verts ? gfxShell.sides : new Set();
    let top = H;
    for (let i = 0; i <= 4; i++) for (let j = 0; j <= 4; j++) top = Math.max(top, ceilAt(def, -W / 2 + (W * i) / 4, -D / 2 + (D * j) / 4));
    const ownerOf = (s) => (!moving ? null : s.placing ? s.placing.owner || null : s.structural ? null
      : furnitureGroups.find((f) => f.type !== 'chair' && onFurniture(f.placement.foot, { x0: s.x0, z0: s.z0, x1: s.x1, z1: s.z1, bottom: s.y0, top: s.y1 })) || null);
    const fixed = standing.filter((s) => {
      const w = s.x1 - s.x0, d = s.z1 - s.z0, h = s.y1 - s.y0;
      return h >= 0.15 && Math.max(w, d) >= 0.08 && Math.min(w, d) >= 0.01 && w * d <= 0.4 * W * D && !ownerOf(s);
    });
    const boxes = fixed.flatMap((s) => s.parts || [{ x0: s.x0, y0: s.y0, z0: s.z0, x1: s.x1, y1: s.y1, z1: s.z1 }]);
    rt.shadowBoxes = boxes;
    const layout = (boxes.length || doorOn) && (floorOk || walls.size) ? mapLayout({ W, D, H: top, floor: floorOk, walls }) : null;
    const res = layout && shadowsOn && boxes.length ? bakeShadows({ layout, lights: rt.lights, amb: rt.amb, lighting: rt.lighting, boxes }) : null;
    rt.shadowStats = { ms: 0, boxes: boxes.length, floor: floorOk, walls: walls.size, bytes: 0, texels: 0, touched: 0 };
    // (with the doorways' light to come, every room that has a floor or walls to take it is handed the map's uniforms now)
    if (layout && doorOn && !res) rt.lm = { layout, shadows: false, materials: [], uniforms: { uLm: { value: layoutUniforms(layout, W, D).map((v) => new THREE.Vector4(...v)) } } };
    if (rt.lm) Object.assign(rt.lm.uniforms, { uLmC: { value: null }, uDoorL: { value: [0, 1, 2, 3].map(() => new THREE.Vector3()) } });
    if (res) {
      const packed = packShadows(layout, res.ratio);
      const A = mapTexture(kit, layout, packed.A), B = packed.B ? mapTexture(kit, layout, packed.B) : null;
      rt.lm = { layout, shadows: true, A: packed.A, B: packed.B, materials: [],
        uniforms: { uLm: { value: layoutUniforms(layout, W, D).map((v) => new THREE.Vector4(...v)) }, uLmA: { value: A }, uLmB: { value: B || A },
          ...(doorOn ? { uLmC: { value: null }, uDoorL: { value: [0, 1, 2, 3].map(() => new THREE.Vector3()) } } : {}) } };
      // where a still thing's shadow is baked now, the round blot under it is mostly not needed
      const q = c.decals;
      for (let v = 0; v + 3 < q.pos.length / 3; v += 4) {
        if (q.pos[v * 3 + 1] > 0.02) continue;
        let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
        for (let k = 0; k < 4; k++) { const x = q.pos[(v + k) * 3], z = q.pos[(v + k) * 3 + 2]; x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
        const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
        if (fixed.some((s) => Math.abs((s.x0 + s.x1) / 2 - cx) < 0.03 && Math.abs((s.z0 + s.z1) / 2 - cz) < 0.03 && Math.abs(s.x1 - s.x0 + 0.24 - (x1 - x0)) < 0.06 && Math.abs(s.z1 - s.z0 + 0.24 - (z1 - z0)) < 0.06))
          for (let k = 0; k < 4; k++) q.col[(v + k) * 4 + 3] *= BLOT_FADE;
      }
      Object.assign(rt.shadowStats, { texels: layout.width * layout.height, touched: res.touched, polygons: res.polygons,
        bytes: packed.A.data.length + (packed.B?.data.length || 0), size: [layout.width, layout.height], cell: layout.cell });
    }
    rt.shadowStats.ms = Math.round(performance.now() - t0);
  }
  const furnitureGroups = [];
  function separateFurniture() {
    const candidates = placements.filter(p => furnitureType(p.type));
    for (const p of candidates) {
      const f = p.foot, floor = rt.floorY ? rt.floorY(f.x, f.z) : floorAt(def, f.x, f.z);
      p.floor = floor;
      const stacked = candidates.some(q => q !== p && overlaps(f, q.foot, .08) && q.foot.bottom > f.bottom + .2 && q.foot.bottom < f.top + 1.1);
      p.fixed = fixedFurnitureReason(p.type, f, p.opt, floor, stacked);
      if (p.fixed) {
        // Sunk, hanging and toppled pieces already show their predicament.
        // An otherwise ordinary-looking base in a stack gets steel feet.
        if (p.fixed === 'stacked' || p.fixed === 'anchored') for (const x of [f.x0, f.x1]) for (const z of [f.z0, f.z1]) {
          c.flat.box(x - .10, floor + .008, z - .09, x + .10, floor + .035, z + .09, [.13, .15, .14]);
          c.flat.box(x - .025, floor + .035, z - .025, x + .025, floor + .06, z + .025, [.32, .29, .23]);
        }
        continue;
      }
      const group = new THREE.Group();
      group.position.copy(rt.group.position); group.rotation.copy(rt.group.rotation);
      group.name = `furniture:${def.id}:${p.type}:${furnitureGroups.length}`;
      world.scene.add(group);
      const record = { id: group.name, type: p.type, label: FURNITURE[p.type], room: rt.id, ...worldFootprint(f, def, toWorld), surfaceY: (def.y || 0) + f.top, group, collider: null };
      p.owner = record; record.placement = p; record.attachments = [];
      if (env.lighting || rt.lighting) record.lightTint = new THREE.Vector3(1, 1, 1);
      furnitureGroups.push(record); world.furniture.push(record);
    }
    const parentFor = foot => furnitureGroups.find(f => f.type !== 'chair' && onFurniture(f.placement.foot, foot));
    for (const p of placements) if (!p.owner && !furnitureType(p.type)) p.owner = parentFor(p.foot);
    // Every child collider is replaced by the single carried footprint. It
    // can be ignored as one object by the swept movement solver.
    for (const f of furnitureGroups) {
      const owned = placements.filter(p => p.owner === f), bounds = { ...f.placement.foot };
      for (const p of owned) {
        if (p.collider) rt.colliders.splice(rt.colliders.indexOf(p.collider), 1);
        bounds.x0 = Math.min(bounds.x0, p.foot.x0); bounds.z0 = Math.min(bounds.z0, p.foot.z0);
        bounds.x1 = Math.max(bounds.x1, p.foot.x1); bounds.z1 = Math.max(bounds.z1, p.foot.z1); bounds.top = Math.max(bounds.top, p.foot.top);
      }
      Object.assign(f, worldFootprint(bounds, def, toWorld));
      f.y = (def.y || 0) + f.placement.floor;
      const collider = f.collider = { x0: f.x0, z0: f.z0, x1: f.x1, z1: f.z1, get top() { return f.top; }, tall: false, on: true, furniture: f.id };
      rt.colliders.push(collider); world.furnitureColliders.push(collider);
      const touching = () => world.rooms.filter(room => overlaps(f, room.rect)).map(room => room.id);
      let lastX = f.x, lastZ = f.z, lastRooms = touching();
      f.translate = (dx, dz, dy = 0) => {
        if (f.away || ![dx, dz, dy].every(Number.isFinite) || Math.hypot(dx, dz, dy) < 1e-6) return false;
        const wasSolid = collider.on !== false, oldRooms = touching(), oldRoom = world.rooms.find(room => room.id === f.room);
        for (const k of ['x', 'x0', 'x1']) f[k] += dx;
        for (const k of ['z', 'z0', 'z1']) f[k] += dz;
        for (const k of ['y', 'top', 'surfaceY']) f[k] += dy;
        Object.assign(collider, { x0: f.x0, z0: f.z0, x1: f.x1, z1: f.z1, on: !f.carried });
        f.group.position.x += dx; f.group.position.z += dz; f.group.position.y += dy;
        const now = world.roomAt(f.x, f.z) || oldRoom;
        if (now && now !== oldRoom) {
          const i = oldRoom?.colliders.indexOf(collider); if (i >= 0) oldRoom.colliders.splice(i, 1);
          now.colliders.push(collider); f.room = now.id;
          f.group.traverse(object => { if (object.material?.userData.furnitureLight) return; const u = object.material?.uniforms; if (u?.uDim) u.uDim = now.u.dim; if (u?.uFlick) u.uFlick = now.u.flick; });
        }
        for (const use of f.attachments) {
          use.wx += dx; use.wz += dz;
          const nextRoom = world.roomAt(use.wx, use.wz) || now, local = toLocal(nextRoom.def, use.wx, use.wz);
          Object.assign(use, { x: local.x, z: local.z });
          if (use.room !== nextRoom) {
            const i = use.room.uses.indexOf(use); if (i >= 0) use.room.uses.splice(i, 1);
            nextRoom.uses.push(use); use.room = nextRoom;
          }
        }
        const nextRooms = touching(), changedRooms = nextRooms.join(',') !== lastRooms.join(',');
        if (!f.carried && (!wasSolid || changedRooms || Math.hypot(f.x - lastX, f.z - lastZ) >= .05)) {
          for (const id of new Set([...lastRooms, ...oldRooms, ...nextRooms])) {
            const rev = (world.furnitureRevision.get(id) || 0) + 1;
            world.furnitureRevision.set(id, rev); world.rooms.find(room => room.id === id).furnitureRevision = rev;
          }
          lastRooms = nextRooms; lastX = f.x; lastZ = f.z;
        }
        f.group.visible = !f.away && nextRooms.some(id => world.rooms.find(room => room.id === id).group.visible);
        return true;
      };
    }
    for (const entry of batches.values()) {
      const groups = new Map();
      for (const q of entry.chunks) {
        q.owner = q.placement ? q.placement.owner : entry.structural ? null : parentFor(chunkBounds(entry.batch, q.start, q.end));
        if (!q.owner) continue;
        if (!q.placement) q.owner.top = Math.max(q.owner.top, (def.y || 0) + chunkBounds(entry.batch, q.start, q.end).top);
        if (!groups.has(q.owner)) groups.set(q.owner, []);
        groups.get(q.owner).push(q);
      }
      entry.moving = entry.batch.uncarried ? [] : [...groups].map(([owner, chunks]) => ({ owner, batch: copyChunks(entry.batch, chunks) }));
      if (groups.size) {
        const still = copyChunks(entry.batch, entry.chunks.filter(q => !q.owner));
        for (const key of ['pos', 'nor', 'uv', 'alb', 'ao', 'idx', 'vx', 'sf']) entry.batch[key] = still[key];
      }
    }
    for (const q of decalChunks) q.owner = q.placement?.owner;
    const decals = c.decals;
    for (const f of furnitureGroups) f.decals = copyChunks(decals, decalChunks.filter(q => q.owner === f), true);
    c.decals = copyChunks(decals, decalChunks.filter(q => !q.owner), true);
    // Uses belong to the carried physical thing as well as its picture.
    for (const use of rt.uses) {
      const f = furnitureGroups.find(f => f.type !== 'chair' && use.wx >= f.x0 && use.wx <= f.x1 && use.wz >= f.z0 && use.wz <= f.z1);
      if (f) { f.attachments.push(use); use.furniture = f; }
    }
  }

  const c = {
    world, kit, env, level, room: def, rt, R, W, D, H, look, params: def.params || {},
    vox: track(new Batch(true)), glass: track(new Batch(true)),
    decals: { pos: [], uv: [], col: [], idx: [] },

    /** A batch drawn with `texture` and lit by the bake. One mesh per key. */
    mapped(key, texture, opt = {}) {
      if (!mapped.has(key)) {
        mapped.set(key, { batch: track(new Batch(), ['wall', 'floor', 'ceil'].includes(key)), texture, ...opt });
        if (opt.detail) mapped.get(key).batch.detail = true;            // (fine detail: see c.detail)
        if (gfxOn) noteBoxes(mapped.get(key).batch, ['wall', 'floor', 'ceil'].includes(key));
      }
      return mapped.get(key).batch;
    },
    /**
     * A batch that shines by itself (unlit): lit panels, screens, signs. opt: detail, transparent, alphaTest, side,
     * depthWrite, and bloom (0…3, default 1: how strongly it feeds the glow at Medium and High; kit.glowing, glow.js;
     * how it is drawn does not change). One mesh per key, with the options of the key's first call: a key asked for
     * again with another bloom adds to the first batch at the first number, so two strengths need two keys.
     */
    shining(key, texture, power = 1, rgb = WHITE, opt = {}) {
      if (!shining.has(key)) { shining.set(key, { batch: track(new Batch(), key === 'panel'), texture, power, rgb, opt }); if (opt.detail) shining.get(key).batch.detail = true; }
      return shining.get(key).batch;
    },
    get flat() { return c.mapped('flat', kit.tex.white()); },
    /**
     * Fine detail the room could lose and still be the same room (mouldings, frames, relief, clutter nothing depends on):
     * a batch like c.flat whose mesh is marked `userData.detail`, which a low Graphics setting hides (graphics.js
     * showDetail). `detail: true` in the options of c.mapped and c.shining marks theirs the same way, and nothing else
     * about them changes. It counts toward the room's detail budget (docs/BACKROOMS.md). Nothing collidable, readable or
     * usable may go in one: put that in an ordinary batch. (A key's options are the ones it was first asked for with.)
     */
    get detail() { return c.mapped('detail', kit.tex.white(), { detail: true }); },
    get wall() { return c.mapped('wall', kit.tex.wallpaper(look)); },
    get floor() { return c.mapped('floor', kit.tex.floor(look)); },
    get ceil() { return c.mapped('ceil', kit.tex.ceiling(look.ceil)); },

    toWorld: (x, z) => toWorld(def, x, z),
    toLocal: (x, z) => toLocal(def, x, z),
    /** Height of this room's ceiling, and of its floor, at a spot (above the room's own level). */
    ceilAt: (x, z) => ceilAt(def, x, z),
    floorAt: (x, z) => floorAt(def, x, z),

    /** A baked light. power 1 ≈ one ceiling panel. */
    light(x, y, z, color, power = 1, opt = {}) {
      const rgb = typeof color === 'string' ? lin(color) : color;
      const l = lamp(x, y, z, rgb.map((v) => v * power), opt);
      rt.lights.push(l);
      return l;
    },
    /** The light at a spot, for things that are added after the bake. */
    sample: (x, y, z, nx = 0, ny = 1, nz = 0) => lightAt(rt.lights, rt.amb, x, y, z, nx, ny, nz),

    /* ---- where things can go ---------------------------------------------------- */
    /** A point on a wall, `off` metres into the room, and the turn that makes a thing there face the room. */
    wallAt(side, at, off = 0) {
      const w = WALLS[side], o = w.o(W, D), s = w.s(at, W, D);
      return { x: o[0] + w.U[0] * s + w.n[0] * off, z: o[2] + w.U[2] * s + w.n[2] * off, rot: Math.atan2(w.n[0], w.n[2]), n: w.n, U: w.U };
    },
    /** The stretches of a wall with nothing in the way — no doorway, window, stairs or filled-in corner: [[from, to], …]. */
    spans(side, margin = 0.3, minTop = 0) {
      const out = [];
      for (let [a, b] of wallSpans(def, side, margin, minTop)) {
        // …less whatever stretch of this wall is already spoken for (keepWall)
        for (const [s, k0, k1] of kept) { if (s !== side || k1 <= a || k0 >= b) continue; if (k0 - a > 0.05) out.push([a, k0]); a = Math.max(a, k1); }
        if (b - a > 0.05) out.push([a, b]);
      }
      return out;
    },
    /** This stretch of a wall is taken: nothing else is to be hung on it. */
    keepWall(side, from, to) { kept.push([side, from, to]); kept.sort((p, q) => p[1] - q[1]); },
    /** A random stretch of free wall at least `need` long, under at least `minTop` of ceiling → { side, at } (its middle), or null. */
    wallSpot(need, sides = ['back', 'left', 'right', 'front'], margin = 0.35, minTop = 2.25) {
      const options = [];
      for (const side of sides) for (const [a, b] of c.spans(side, margin, minTop)) if (b - a >= need) options.push({ side, a, b });
      if (!options.length) return null;
      const o = R.pick(options);
      return { side: o.side, at: R.range(o.a + need / 2, o.b - need / 2) };
    },
    reserve(x, z, r) { reserved.push([x, z, r]); },
    /** Is this bit of floor free — level, clear of doorways' approaches, stairs, pillars and what was put down before? */
    clear(x, z, r = 0.4, head = 0) {
      if (Math.abs(x) > W / 2 - r || Math.abs(z) > D / 2 - r) return false;
      for (const dr of def.doors) { const p = doorPoint(dr, 0.6); if (Math.hypot(x - p.x, z - p.z) < r + 0.55 + dr.w / 2) return false; }
      for (const [px, pz, pr] of reserved) if (Math.hypot(x - px, z - pz) < r + pr) return false;
      for (const s of stairs) if (x > s.x0 - r && x < s.x1 + r && z > s.z0 - r && z < s.z1 + r) return false;
      for (const [dx, dz] of [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r]]) {
        if (Math.abs(floorAt(def, x + dx, z + dz)) > 0.01 || !fitsAt(def, x + dx, z + dz, 0.05)) return false;
        if (head && ceilAt(def, x + dx, z + dz) < head) return false;
      }
      return true;
    },
    /** A random free spot for something of radius r (and reserve it), or null. opt.head: ceiling it needs above it. */
    spot(r = 0.4, opt = {}) {
      const pad = opt.pad ?? 0.15;
      for (let tries = 0; tries < (opt.tries || 40); tries++) {
        const x = R.range(-W / 2 + r + pad, W / 2 - r - pad), z = R.range(-D / 2 + r + pad, D / 2 - r - pad);
        if (opt.near && Math.hypot(x - opt.near[0], z - opt.near[1]) > opt.near[2]) continue;
        if (!c.clear(x, z, r, opt.head)) continue;
        reserved.push([x, z, r]);
        return { x, z };
      }
      return null;
    },
    /** A corner with no doorway crowding it → { x, z, sx, sz } (sx, sz: which corner), or null. */
    corner(inset = 0.6, pick, head = 0) {
      const all = [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => ({ sx, sz, x: sx * (W / 2 - inset), z: sz * (D / 2 - inset) })).filter((k) => c.clear(k.x, k.z, inset * 0.7, head));
      if (!all.length) return null;
      const k = pick !== undefined ? all[pick % all.length] : R.pick(all);
      reserved.push([k.x, k.z, inset]);
      return k;
    },
    doorPoint,

    /* ---- solid things -------------------------------------------------------------- */
    /** Something you cannot walk through, in room coordinates. tall: also blocks the view. */
    solid(x0, z0, x1, z1, opt = {}) {
      const a = toWorld(def, x0, z0), b = toWorld(def, x1, z1);
      const col = { x0: Math.min(a.x, b.x), z0: Math.min(a.z, b.z), x1: Math.max(a.x, b.x), z1: Math.max(a.z, b.z), tall: !!opt.tall, keep: !!opt.keep, on: opt.on !== false, ...(Number.isFinite(opt.top) ? { top: (def.y || 0) + opt.top } : {}) };
      rt.colliders.push(col);
      return col;
    },
    /** A dark soft patch on the floor under something. */
    shadow(x, z, w, d, strength = 0.5, y = 0.006) { c.blot(x, z, w + 0.24, d + 0.24, { a: strength, y }); },
    /** A soft-edged stain: on the floor, or (down: true) on the underside of the ceiling. */
    blot(x, z, w, d, o = {}) {
      const q = c.decals, base = q.pos.length / 3, hw = w / 2, hd = d / 2, y = o.y ?? 0.006, rgb = o.rgb || [0, 0, 0];
      const first = q.idx.length;
      if (o.down) q.pos.push(x - hw, y, z - hd, x + hw, y, z - hd, x + hw, y, z + hd, x - hw, y, z + hd);
      else q.pos.push(x - hw, y, z + hd, x + hw, y, z + hd, x + hw, y, z - hd, x - hw, y, z - hd);
      q.uv.push(0, 0, 1, 0, 1, 1, 0, 1);
      for (let i = 0; i < 4; i++) q.col.push(rgb[0], rgb[1], rgb[2], o.a ?? 0.5);
      q.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
      if (moving) decalChunks.push({ start: base, end: base + 4, first, last: q.idx.length, placement: placing });
    },
    /**
     * Put a meshed voxel model down. opt: rot (about y), y, flip (hang it from height y, upside down),
     * scale (number or [x,y,z]), tint, mono, solid, shadow, tall, tilt:[rx,rz], quat, mirror, batch.
     * → its footprint { x0, z0, x1, z1, top, w, d, h } in room coordinates.
     */
    place(geo, x, z, opt = {}) {
      if (!geo) return null;
      const s = Array.isArray(opt.scale) ? opt.scale : [opt.scale || 1, opt.scale || 1, opt.scale || 1];
      if (opt.quat) quat.copy(opt.quat);
      else { eul.set(opt.tilt ? opt.tilt[0] : 0, opt.rot || 0, (opt.flip ? Math.PI : 0) + (opt.tilt ? opt.tilt[1] : 0), 'YXZ'); quat.setFromEuler(eul); }
      scl.set(VOX * s[0] * (opt.mirror ? -1 : 1), VOX * s[1], VOX * s[2]);
      mat.compose(vec.set(x, opt.y || 0, z), quat, scl);
      const b = geo.bounds;
      let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const bx of [b.x0, b.x1]) for (const by of [b.y0, b.y1]) for (const bz of [b.z0, b.z1]) {
        vec.set(bx, by, bz).applyMatrix4(mat);
        x0 = Math.min(x0, vec.x); x1 = Math.max(x1, vec.x); z0 = Math.min(z0, vec.z); z1 = Math.max(z1, vec.z); y0 = Math.min(y0, vec.y); y1 = Math.max(y1, vec.y);
      }
      const foot = { x0, z0, x1, z1, top: y1, bottom: y0, w: x1 - x0, d: z1 - z0, h: y1 - y0, x, z };
      const before = placing;
      if (moving && !opt.batch) { placing = { type: opt.furnitureType, foot, opt }; placements.push(placing); }
      const stood = gfxOn && (!opt.batch || ownBatch(opt.batch)) ? { x0, y0, z0, x1, y1, z1, placing, structural: false } : null;
      if (stood) standing.push(stood);
      const into = opt.batch || c.vox, i0 = into.idx.length;
      into.addVox(geo.solid, mat, opt);
      // (c.prop's own: what is laid over a model as fine detail, the keys on a keyboard, at the same place, into the room's
      // one batch of it, hidden at a low Graphics setting. Placed now, so that it belongs to whatever the model belongs to:
      // on something that can be dragged it is left out, not left behind, and the thing carries what it always carried.
      // Nor into a batch a room gives it: nothing of that one mesh could be left out without the rest)
      if (opt.over && !opt.batch) voxBatch('prop-detail', { detail: true, uncarried: true }).addVox(opt.over.solid, mat, opt);
      // (kit.gfx.shadows: what it really is, in columns, while its triangles are still where they were put)
      if (stood && mapOn) stood.parts = modelColumns(into, i0, into.idx.length, stood);
      if (geo.glass) c.glass.addVox(geo.glass, mat, opt);
      if (opt.solid !== false && y0 < 1.0 && y1 > 0.25) {
        const col = c.solid(x0 + 0.03, z0 + 0.03, x1 - 0.03, z1 - 0.03, { tall: opt.tall ?? y1 > 1.25, top: y1 });
        if (placing !== before) placing.collider = col;
      }
      if (opt.shadow !== false && y0 < 0.3) c.shadow((x0 + x1) / 2, (z0 + z1) / 2, foot.w, foot.d, opt.shadow || 0.45);
      placing = before;
      return foot;
    },
    /** Something from the office's catalogue (desk, chair, cooler…), or a plain crate if it is not there. */
    prop(type, x, z, opt = {}) {
      // (a desk, a chair, a monitor, a keyboard, a filing cabinet, a stack of boxes, a bin, a trolley and a water cooler are
      // the level's own: desk.model.js, workstation.model.js, storage.model.js, smalls.model.js, each the office's bounds
      // exactly at half-size voxels, so its foot, its collider and its top are where they were; only where the catalogue has
      // that thing at all, so nothing gains one.
      // The chair is in the cloth the office's would have been; the boxes are the stack the office's would have been, of
      // its three; the monitor is on. A keyboard's keys are laid over its case as detail (c.place, `over`), and only where
      // it stays put: the case alone is a whole keyboard)
      const own = env.catalogue.has(type) ? levelProp(kit, env.catalogue, type, opt.o) : null;
      const geo = own ? own.geo : env.catalogue.geo(type, opt.o);
      if (geo) {
        const k = own ? own.scale : 1, scale = !own ? opt.scale : Array.isArray(opt.scale) ? opt.scale.map((n) => n * k) : (opt.scale || 1) * k;
        const foot = c.place(geo, x, z, { ...opt, scale, furnitureType: type, over: own?.over });
        if (moving && opt.batch && furnitureType(type)) {
          // A transforming room owns this entire batch. Its furniture is
          // bolted to that scenery, with the bolts in the same moving mesh.
          const anchor = kit.model('furniture:fixed-foot:v1', fixedFurnitureFoot);
          for (const px of [foot.x0 + .04, foot.x1 - .04]) for (const pz of [foot.z0 + .04, foot.z1 - .04]) {
            c.place(anchor, px, pz, { batch: opt.batch, y: foot.bottom, solid: false, shadow: false });
          }
          foot.fixed = 'anchored';
        }
        return foot;
      }
      const [w, h, d] = opt.fallback || [0.6, 0.8, 0.6];
      return c.crate(x, z, w, h, d, opt.rot || 0, [0.6, 0.55, 0.45], opt);
    },
    hasProp: (type) => env.catalogue.has(type),
    /** A voxel model sculpted for this level: `make()` → Vox, meshed once per key. */
    model(key, make, x, z, opt = {}) { return c.place(kit.model(key, make), x, z, opt); },
    /** A plain painted block standing on the floor (or at opt.y), turned by rot. */
    crate(x, z, w, h, d, rot = 0, rgb = [0.6, 0.55, 0.45], opt = {}) {
      const y = opt.y || 0, turned = Math.abs(Math.sin(rot)) > 0.7, ww = turned ? d : w, dd = turned ? w : d;
      (opt.batch || c.flat).box(x - ww / 2, y, z - dd / 2, x + ww / 2, y + h, z + dd / 2, rgb, { skip: y ? '' : '-y' });
      if (opt.solid !== false && y < 1 && h > 0.25) c.solid(x - ww / 2, z - dd / 2, x + ww / 2, z + dd / 2, { tall: opt.tall ?? y + h > 1.25, top: y + h });
      if (opt.shadow !== false && y < 0.3) c.shadow(x, z, ww, dd, 0.45);
      return { x0: x - ww / 2, z0: z - dd / 2, x1: x + ww / 2, z1: z + dd / 2, top: y + h, bottom: y, w: ww, d: dd, h, x, z };
    },
    /** A flat picture on a wall: batch decides the texture, uv picks the part of it. */
    hang(batch, side, at, y, w, h, uv = null, alb = WHITE, off = 0.012) {
      const p = c.wallAt(side, at, off), U = p.U, hw = w / 2, hh = h / 2;
      batch.quad([p.x - U[0] * hw, y - hh, p.z - U[2] * hw], [p.x + U[0] * hw, y - hh, p.z + U[2] * hw], [p.x + U[0] * hw, y + hh, p.z + U[2] * hw], [p.x - U[0] * hw, y + hh, p.z - U[2] * hw], alb, uv);
      return p;
    },
    /** A flat picture lying on the floor (or at height y, or face down on the ceiling), turned by rot. */
    lay(batch, x, z, w, d, rot = 0, uv = null, alb = WHITE, y = 0.008, down = false) {
      const cs = Math.cos(rot), sn = Math.sin(rot), hw = w / 2, hd = d / 2;
      const pt = (lx, lz) => [x + lx * cs + lz * sn, y, z - lx * sn + lz * cs];
      if (down) batch.quad(pt(hw, hd), pt(-hw, hd), pt(-hw, -hd), pt(hw, -hd), alb, uv);
      else batch.quad(pt(-hw, hd), pt(hw, hd), pt(hw, -hd), pt(-hw, -hd), alb, uv);
    },
    /** A box against a wall: `w` wide around `at`, from y0 to y1, standing d0…d1 out from the wall. */
    wbox(side, at, w, y0, y1, d0, d1, rgb = WHITE, opt = {}) {
      const a = c.wallAt(side, at - w / 2, d0), b = c.wallAt(side, at + w / 2, d1);
      (opt.batch || c.flat).box(Math.min(a.x, b.x), y0, Math.min(a.z, b.z), Math.max(a.x, b.x), y1, Math.max(a.z, b.z), rgb, opt);
      return a;
    },
    /** Something from the catalogue that hangs on a wall (a clock, a painting). */
    wallProp(type, side, at, opt = {}) {
      const p = c.wallAt(side, at, 0.005), entry = env.catalogue.entry(type);
      return c.prop(type, p.x, p.z, { rot: p.rot, y: opt.y ?? entry?.y ?? 1.4, solid: false, shadow: false, fallback: [0.4, 0.4, 0.05], ...opt });
    },
    /** A missing ceiling tile: a black square where one should be (x, z snapped to the tile grid). */
    hole(x, z, n = 1) {
      const sx = Math.round(x / TILE - 0.5) * TILE, sz = Math.round(z / TILE - 0.5) * TILE, k = TILE * n, y = ceilAt(def, sx + k / 2, sz + k / 2) - 0.004;
      c.flat.quad([sx, y, sz], [sx + k, y, sz], [sx + k, y, sz + k], [sx, y, sz + k], [0.004, 0.004, 0.004]);
      return { x: sx + k / 2, z: sz + k / 2, y };
    },
    /**
     * Something that will move: its own mesh, lit by this room's bake. Author the batch in room
     * coordinates; `pivot` is the point it turns about. → a Group to move and turn.
     */
    dynamic(batch, opt = {}) {
      const holder = new THREE.Group(), pv = opt.pivot || [0, 0, 0];
      holder.position.set(pv[0], pv[1], pv[2]);
      rt.group.add(holder);
      if (moving) added.push(holder);
      c.after.push(() => {
        const geo = kit.geometry(batch, opt.unlit ? [] : rt.lights, opt.unlit ? [1.25, 1.25, 1.25] : rt.amb, opt.unlit ? null : rt.lighting);
        if (!geo) return;
        const mesh = new THREE.Mesh(geo, kit.surface({ map: opt.map || (batch.vox ? null : kit.tex.white()), vox: batch.vox, room: rt.u, cutout: opt.cutout, flick: geo.userData.flick, banks: geo.userData.banks, side: opt.side }));
        mesh.position.set(-pv[0], -pv[1], -pv[2]);
        holder.add(mesh); holder.userData.mesh = mesh;
        if (moving && (env.lighting || rt.lighting) && !opt.unlit) mesh.userData.followFurnitureLight = f => {
          mesh.geometry = kit.geometry(batch, [], WHITE);
          delete mesh.material.defines.BANKS; delete mesh.material.defines.FLICK;
          mesh.material.uniforms.uDim = {value:1}; mesh.material.uniforms.uFlick = {value:1};
          mesh.material.uniforms.uTint.value = f.lightTint; mesh.material.userData.furnitureLight = true;
          mesh.material.needsUpdate = true;
        };
      });
      return holder;
    },
    /** Register a room-built c.dynamic/c.add Group. The entire assembly must
     * have its own group (not a piece of the static room batch). */
    movable(group, spec) {
      const f = registerMovable(world, rt, group, spec);
      if (!f) return null;
      group.userData.movable = f;
      if (env.lighting || rt.lighting) f.lightTint = new THREE.Vector3(1, 1, 1);
      c.after.push(() => {
        rt.group.updateMatrixWorld(true); world.scene.attach(group);
        if (f.lightTint) group.traverse(o => o.userData.followFurnitureLight?.(f));
      });
      return f;
    },
    /** An explicit, bounded solution witness; it is physically rehearsed by
     * the no-trap validator, from every possible entrance, before accepting it. */
    bridgeRoute(item, { stand, path = [] } = {}) {
      if (!item?.bridge || item.room !== rt.id || !stand || !Number.isFinite(stand.x) || !Number.isFinite(stand.z) || !Array.isArray(path) || path.length > 8 || path.some(p => !Number.isFinite(p?.x) || !Number.isFinite(p?.z))) throw Error('bridgeRoute: supply this room\'s cutout, a standing point and up to eight finite hinge waypoints');
      const plan = { item, stand: { ...stand }, path: path.map(p => ({ ...p })) };
      (rt.bridgePlans ||= []).push(plan); return plan;
    },
    /** A sheet of paper on the floor. */
    paper(x, z, rot = R.range(-3, 3), color) { c.lay(c.mapped('paper' + (color || ''), kit.tex.paper(color)), x, z, 0.21, 0.297, rot, null, WHITE, floorAt(def, x, z) + 0.006 + R() * 0.004); },
    /** A free-standing upright picture facing `rot` (0 = toward +z). */
    board(batch, x, y, z, w, h, rot = 0, uv = null, alb = WHITE) {
      const cs = Math.cos(rot), sn = Math.sin(rot), hw = w / 2, hh = h / 2;
      batch.quad([x - cs * hw, y - hh, z + sn * hw], [x + cs * hw, y - hh, z - sn * hw], [x + cs * hw, y + hh, z - sn * hw], [x - cs * hw, y + hh, z + sn * hw], alb, uv);
    },

    /* ---- things that happen -------------------------------------------------------- */
    add(object) { rt.group.add(object); if (moving) added.push(object); return object; },
    /** Something E can be pressed at. { x, z, r?, label, use(), when?() } in room coordinates. */
    use(spec) {
      const p = toWorld(def, spec.x, spec.z);
      const u = { r: 1.5, ...spec, wx: p.x, wz: p.z, room: rt };
      rt.uses.push(u);
      return u;
    },
    /**
     * Leave something for the visitor to pick up (an inventory item type: paper, balloon, torch…) at a spot of the room, `opt.y` metres up.
     * It is put down when the part's pockets are hung (inventory.js), so a visit without pockets leaves nothing: the room must cope.
     */
    leave(type, x, z, opt = {}) { (rt.left ||= []).push({ type, x, z, y: opt.y || 0, quantity: opt.quantity, charge: opt.charge, taken: opt.taken }); },
    /**
     * The room's resident has got the visitor: n hearts where there is health, and the end of the tape only where there is none or that
     * was the last of them (as a creature's c.hurt: pursuer.js). → { landed, dead, ended }. After one that was survived: let go.
     * A hit that lands and is survived throws the visitor back from `from` ({ x, z } in WORLD coordinates, as c.toWorld gives
     * and as a denizen's own x, z are: where the blow came from); without it, straight back from where they are looking (player.js knock).
     */
    hurt(n = 1, from = null) {
      // (if this is the last of them, it was this room's doing: the building's camera asks the room what to show — rt.takes(shot),
      // as a creature's takes(shot). Noted before the hit, because the hit is what ends the visit.)
      const before = env.tookBy; env.tookBy = { id: def.arch || null, it: rt };
      const hit = env.health?.damage(n);
      if (hit) {
        const ended = !!hit.dead && !env.hasSurvivor?.(); if (!ended) env.tookBy = before;
        if (hit.ok && !hit.dead) env.player?.knock?.(from);
        return { landed: !!hit.ok, dead: !!hit.dead, ended };
      }
      env.end('caught'); return { landed: true, dead: true, ended: true };
    },
    /** For the count kept of a visit: the resident (its own id) has really been seen, once · it had the visitor and they got away, each time. */
    met: (id) => env.run?.met?.(id), survived: (id) => env.run?.survived?.(id),
    /**
     * The fire a spot of this room is within sight and reach of (paper the visitor has lit): { x, z, remaining } in the room's own
     * frame — or null: none, or a visit without pockets. (As a creature's c.fire: pursuer.js.)
     */
    fire(x, z) { const p = toWorld(def, x, z), f = env.inventory?.fire?.threatAt?.(p.x, p.z, world.floorY(p.x, p.z)); if (!f) return null; const q = toLocal(def, f.x, f.z); return { x: q.x, z: q.z, remaining: f.remaining }; },
    /** A patch of floor that notices you: { x0, z0, x1, z1, enter?, leave?, stay? }. */
    zone(spec) { rt.zones.push({ in: false, ...spec }); return spec; },
    /** Runs every frame while you are in this room or next door: fn(dt, t, me) with me in room coordinates. */
    tick(fn) { rt.ticks.push(fn); },
    /**
     * Mark a sheet this room drew as a liquid's surface (liquid.js): `target` the mesh, the group it is put in once the
     * room is lit, or the batch it is drawn from; opt { kind: 'water', phase ({ value }: drifts its ripple), flow, y }.
     * It draws nothing and changes nothing of the sheet; where the Graphics setting has water, a flat one is drawn as
     * water. → a handle { disturb() } (which does nothing yet). Call it while building, not from a tick.
     */
    liquid(target, opt = {}) { return markLiquid(c, target, opt); },
    /** Is a point of this room on the player's screen right now? */
    seen(x, z, opt) { const p = toWorld(def, x, z); return env.sees(p.x, p.z, opt); },

    /* ---- the shell ------------------------------------------------------------------- */
    /**
     * Floor, ceiling with its panels, four walls with their doorways and windows, skirting, sockets —
     * and whatever the room's shape adds: stairs up to a raised doorway, a pit or a dais, a ceiling in two heights
     * or on a slope, a beam hung across.
     * opt: { H (a flat ceiling at this height, ignoring the shape), floor:false, ceiling:false, walls:false|[sides],
     *        wallTex, floorTex, ceilTex, panels:false, skirting:false, sockets:false, floorAlb, wallAlb, ceilAlb, trim }
     */
    shell(opt = {}) {
      const s = opt.H !== undefined ? null : def.shape, hNom = opt.H ?? H;
      const top = (x, z) => (opt.H !== undefined ? opt.H : ceilAt(def, x, z));
      const wallB = opt.wallTex ? c.mapped('wall', opt.wallTex) : c.wall;
      const floorB = opt.floorTex ? c.mapped('floor', opt.floorTex) : c.floor;
      const ceilB = opt.ceilTex ? c.mapped('ceil', opt.ceilTex) : c.ceil;
      const edge = (a, la, b, lb) => 0.76 + 0.24 * smooth(Math.min(a, la - a, b, lb - b) / 0.45);
      const trim = opt.trim || lin(look.trim), wAlb = opt.wallAlb || WHITE, fAlb = opt.floorAlb || WHITE;
      const sides = opt.walls === false ? [] : (opt.walls || ['back', 'front', 'left', 'right']);
      if (kit.gfx) gfxShell = { fAlb: opt.floor !== false ? fAlb : null, wAlb: sides.length ? wAlb : null, sides: new Set(sides) };

      /* the floor: flat, or stepping down into a pit, or up onto a dais */
      if (opt.floor !== false) {
        const rect = (x0, z0, x1, z1, y) => { if (x1 - x0 > 0.005 && z1 - z0 > 0.005) floorB.grid([x0, y, z0], [0, 0, 1], [1, 0, 0], ticks(z1 - z0), ticks(x1 - x0), (u, v) => [(x0 + v + def.cx) / 1.6, (z0 + u + def.cz) / 1.6], fAlb, (u, v) => edge(z0 + u + D / 2, D, x0 + v + W / 2, W)); };
        const frame = (o, i, y) => { rect(o.x0, o.z0, o.x1, i.z0, y); rect(o.x0, i.z1, o.x1, o.z1, y); rect(o.x0, i.z0, i.x0, i.z1, y); rect(i.x1, i.z0, o.x1, i.z1, y); };
        const all = { x0: -W / 2, z0: -D / 2, x1: W / 2, z1: D / 2 };
        if (s && (s.kind === 'pit' || s.kind === 'dais')) {
          const sign = s.kind === 'pit' ? -1 : 1, inset = (k) => ({ x0: s.x - s.w / 2 + 0.3 * k, z0: s.z - s.d / 2 + 0.3 * k, x1: s.x + s.w / 2 - 0.3 * k, z1: s.z + s.d / 2 - 0.3 * k });
          frame(all, inset(0), 0);
          for (let k = 1; k <= s.n; k++) {
            const o = inset(k - 1), y = sign * k * RISE, lo = Math.min(y, y - sign * RISE), inward = sign < 0;
            if (k < s.n) frame(o, inset(k), y); else rect(o.x0, o.z0, o.x1, o.z1, y);
            // the risers: four low walls of carpet between this level and the one outside it
            const up = [0, RISE], ruv = (u, v) => [u / 1.6, v / 1.6], dark = () => 0.72;
            const face = (org, U, len) => floorB.grid(org, U, UP, ticks(len, 1, 0), up, ruv, fAlb, dark);
            if (inward) { face([o.x0, lo, o.z1], [0, 0, -1], o.z1 - o.z0); face([o.x1, lo, o.z0], [0, 0, 1], o.z1 - o.z0); face([o.x0, lo, o.z0], [1, 0, 0], o.x1 - o.x0); face([o.x1, lo, o.z1], [-1, 0, 0], o.x1 - o.x0); }
            else { face([o.x0, lo, o.z0], [0, 0, 1], o.z1 - o.z0); face([o.x1, lo, o.z1], [0, 0, -1], o.z1 - o.z0); face([o.x1, lo, o.z0], [-1, 0, 0], o.x1 - o.x0); face([o.x0, lo, o.z1], [1, 0, 0], o.x1 - o.x0); }
          }
        } else rect(all.x0, all.z0, all.x1, all.z1, 0);
      }

      /* (kit.gfx.fixtures) the lights that are sculpted fittings: each one's two tiles are left out of the sheet below. A
       * fitting goes only where both were, whole and at the height of the ceiling there; anywhere else (a slope, a tile cut
       * short at a wall, a light under no sheet) the light is the flat panel it always was. */
      const fitOn = kit.gfx?.fixtures > 0 && opt.panels !== false && opt.ceiling !== false, opened = new Map();
      const near = (a, b) => Math.abs(a - b) < 0.005;
      const levelUnder = (p) => { const y = top(p.x, p.z); for (const dx of [-1, 0, 1]) for (const dz of [-1, 0, 1]) if (Math.abs(top(p.x + dx * TILE * 0.49, p.z + dz * TILE * 0.98) - y) > 0.002) return false; return true; };
      const openFor = (x0, x1, z0, z1, y) => {
        for (const p of def.panels) {
          if (!near(x0, p.x - TILE / 2) || !near(x1, p.x + TILE / 2) || !((near(z0, p.z - TILE) && near(z1, p.z)) || (near(z0, p.z) && near(z1, p.z + TILE)))) continue;
          if (Math.abs(y - top(p.x, p.z)) > 0.002 || !levelUnder(p)) return true;
          opened.set(p, (opened.get(p) || 0) + 1);
          return false;
        }
        return true;
      };
      /* the ceiling: one sheet, two sheets at different heights, or a slope — and perhaps a beam under it */
      if (opt.ceiling !== false) {
        const cAlb = opt.ceilAlb || WHITE;
        const sheet = (x0, z0, x1, z1, yOf) => { if (x1 - x0 > 0.01 && z1 - z0 > 0.01) ceilB.grid([x0, 0, z0], [1, 0, 0], [0, 0, 1], tiles(x0, x1), tiles(z0, z1), (u, v) => [(x0 + u) / TILE, (z0 + v) / TILE], cAlb, (u, v) => edge(x0 + u + W / 2, W, z0 + v + D / 2, D), (u, v, x, z) => yOf(x, z),
          fitOn ? (u, v, du, dv) => openFor(x0 + u - du / 2, x0 + u + du / 2, z0 + v - dv / 2, z0 + v + dv / 2, yOf(x0 + u, z0 + v)) : null); };
        if (s && s.kind === 'stepceil') {
          const hNeg = s.dir > 0 ? s.h1 : s.h2, hPos = s.dir > 0 ? s.h2 : s.h1, lo = Math.min(hNeg, hPos), rows = ticks(Math.abs(hPos - hNeg), 0.45, 0.08), buv = (u, v) => [u / 0.8, (lo + v) / 0.8], shade = () => 0.86;
          if (s.axis === 'x') {
            sheet(-W / 2, -D / 2, s.at, D / 2, () => hNeg); sheet(s.at, -D / 2, W / 2, D / 2, () => hPos);
            if (hPos > hNeg) wallB.grid([s.at, lo, D / 2], [0, 0, -1], UP, ticks(D), rows, buv, wAlb, shade); else wallB.grid([s.at, lo, -D / 2], [0, 0, 1], UP, ticks(D), rows, buv, wAlb, shade);
          } else {
            sheet(-W / 2, -D / 2, W / 2, s.at, () => hNeg); sheet(-W / 2, s.at, W / 2, D / 2, () => hPos);
            if (hPos > hNeg) wallB.grid([-W / 2, lo, s.at], [1, 0, 0], UP, ticks(W), rows, buv, wAlb, shade); else wallB.grid([W / 2, lo, s.at], [-1, 0, 0], UP, ticks(W), rows, buv, wAlb, shade);
          }
        } else sheet(-W / 2, -D / 2, W / 2, D / 2, s && s.kind === 'slopeceil' ? top : () => hNom);
        if (s && s.kind === 'soffit') {
          const lo = s.at - s.t / 2, hi = s.at + s.t / 2, y = s.clear, rows = ticks(hNom - y, 0.45, 0.08), buv = (u, v) => [u / 0.8, (y + v) / 0.8], under = () => 0.8;
          if (s.axis === 'x') {
            ceilB.grid([-W / 2, y, lo], [1, 0, 0], [0, 0, 1], tiles(-W / 2, W / 2), tiles(lo, hi), (u, v) => [(-W / 2 + u) / TILE, (lo + v) / TILE], cAlb, under);
            wallB.grid([-W / 2, y, hi], [1, 0, 0], UP, ticks(W), rows, buv, wAlb); wallB.grid([W / 2, y, lo], [-1, 0, 0], UP, ticks(W), rows, buv, wAlb);
          } else {
            ceilB.grid([lo, y, -D / 2], [1, 0, 0], [0, 0, 1], tiles(lo, hi), tiles(-D / 2, D / 2), (u, v) => [(lo + u) / TILE, (-D / 2 + v) / TILE], cAlb, under);
            wallB.grid([hi, y, D / 2], [0, 0, -1], UP, ticks(D), rows, buv, wAlb); wallB.grid([lo, y, -D / 2], [0, 0, 1], UP, ticks(D), rows, buv, wAlb);
          }
        }
      }

      /* the walls: each is cut to the ceiling above it, with holes for doorways (some up a few stairs) and windows */
      let run = 0;
      for (const side of ['back', 'right', 'front', 'left']) {
        const w = WALLS[side], len = wallLength(def, side), o = w.o(W, D), U = w.U, n = w.n;
        const at = (sv, y = 0, out = 0) => [o[0] + U[0] * sv - n[0] * out, y, o[2] + U[2] * sv - n[2] * out];
        const topS = (sv) => top(o[0] + U[0] * sv + n[0] * 0.03, o[2] + U[2] * sv + n[2] * 0.03);
        const holes = [
          ...def.doors.filter((d) => d.side === side).map((d) => ({ a: w.s(d.c, W, D) - d.w / 2, b: w.s(d.c, W, D) + d.w / 2, y0: d.sill, y1: d.sill + d.h, c: d.c, w: d.w, door: d })),
          ...(def.wins || []).filter((d) => d.side === side).map((d) => ({ a: w.s(d.c, W, D) - d.w / 2, b: w.s(d.c, W, D) + d.w / 2, y0: d.y0, y1: d.y1, c: d.c, w: d.w, win: d })),
        ].sort((p, q) => p.a - q.a);
        const start = run; run += len;
        if (!sides.includes(side)) continue;
        /** One piece of wall from a to b along it, from `bot` up to topOf(s). Cut wherever the ceiling jumps. */
        const piece = (a, b, bot, topOf, skirt) => {
          if (b - a < 0.01) return;
          const cuts = [a];
          let prev = topOf(a + 0.002);
          for (let sv = a + 0.1; sv < b; sv += 0.1) {
            const cur = topOf(sv);
            if (Math.abs(cur - prev) > 0.12) { let lo = sv - 0.1, hi = sv; for (let i = 0; i < 12; i++) { const mid = (lo + hi) / 2; if (Math.abs(topOf(mid) - prev) > 0.06) hi = mid; else lo = mid; } cuts.push(hi); }
            prev = cur;
          }
          cuts.push(b);
          for (let i = 0; i + 1 < cuts.length; i++) {
            const p = cuts[i], q = cuts[i + 1];
            if (q - p < 0.005) continue;
            const here = (u) => topOf(clamp(p + u, p + 0.003, q - 0.003)), tall = here((q - p) / 2) - bot;
            if (tall < 0.02) continue;
            const rows = ticks(tall, 0.45, Math.min(0.16, tall / 3.2)).map((y) => y / tall);
            wallB.grid(at(p), U, UP, ticks(q - p), rows, (u, v) => [(start + p + u) / 0.8, (bot + v * (here(u) - bot)) / 0.8], wAlb,
              (u, v) => { const t = here(u), y = bot + v * (t - bot); return (0.8 + 0.2 * smooth(Math.min(bot > 0.01 ? 9 : y, t - y) / 0.4)) * (0.86 + 0.14 * smooth(Math.min(p + u, len - p - u) / 0.4)); },
              (u, v) => bot + v * (here(u) - bot));
            if (skirt && opt.skirting !== false) {
              const e0 = at(p), e1 = at(q), k = 0.022;
              c.flat.box(Math.min(e0[0], e1[0] + n[0] * k), 0, Math.min(e0[2], e1[2] + n[2] * k), Math.max(e0[0], e1[0] + n[0] * k), 0.11, Math.max(e0[2], e1[2] + n[2] * k), trim, { skip: '-y' });
            }
          }
        };
        let from = 0;
        for (const hole of holes) {
          piece(from, hole.a, 0, topS, true);
          piece(hole.a, hole.b, 0, () => hole.y0, true);                               // under a window, or under a doorway that is up some stairs
          piece(hole.a, hole.b, hole.y1, topS, false);                                 // above it
          // the two cheeks of the opening, its underside, and what you step (or lean) on
          const tall = hole.y1 - hole.y0, cheek = ticks(tall, 0.5, Math.min(0.16, tall / 3.2)), depth = [0, T / 2], cuv = (s0) => (u, v) => [(start + s0 + u) / 0.8, (hole.y0 + v) / 0.8], shade = (u, v) => 0.82 + 0.1 * smooth(v / 0.4);
          wallB.grid(at(hole.a, hole.y0), [-n[0], 0, -n[2]], UP, depth, cheek, cuv(hole.a), wAlb, shade);
          wallB.grid(at(hole.b, hole.y0, T / 2), n, UP, depth, cheek, cuv(hole.b - T / 2), wAlb, shade);
          wallB.grid(at(hole.a, hole.y1, T / 2), U, n, ticks(hole.b - hole.a), depth, (u, v) => [(start + hole.a + u) / 0.8, (hole.y1 + v) / 0.8], wAlb, () => 0.7);
          if (hole.door) {
            floorB.grid(at(hole.a, hole.y0, T / 2), n, U, depth, ticks(hole.b - hole.a), (u, v) => [(u + def.cx) / 1.6, (v + def.cz) / 1.6], fAlb, () => 0.86);
            if (opt.skirting !== false && hole.y0 < 0.01) for (const [sv, dir] of [[hole.a, 1], [hole.b, -1]]) {
              const e0 = at(sv), e1 = at(sv, 0, T / 2), k = 0.022 * dir;
              c.flat.box(Math.min(e0[0], e1[0] + U[0] * k), 0, Math.min(e0[2], e1[2] + U[2] * k), Math.max(e0[0], e1[0] + U[0] * k), 0.11, Math.max(e0[2], e1[2] + U[2] * k), trim, { skip: '-y' });
            }
            // stairs, inside this room, up to a doorway that is higher than its floor
            if (hole.y0 > 0.01) {
              const steps = Math.round(hole.y0 / RISE), rise = hole.y0 / steps, wood = trim.map((v) => Math.min(1, v * 1.5 + 0.05));
              for (let i = 0; i < steps - 1; i++) {
                c.wbox(side, hole.c, hole.w, 0, hole.y0 - rise * (i + 1), i * RUN, (i + 1) * RUN, wood, { skip: '-y' });
                c.wbox(side, hole.c, hole.w, hole.y0 - rise * (i + 1) - 0.022, hole.y0 - rise * (i + 1) + 0.002, (i + 1) * RUN - 0.03, (i + 1) * RUN + 0.012, trim);
              }
            }
          } else {
            // a window: a sill to lean on, a painted frame, a bar across the middle
            const cream = lin('#e2d8bd'), cy = (hole.y0 + hole.y1) / 2;
            wallB.grid(at(hole.a, hole.y0, T / 2), n, U, depth, ticks(hole.b - hole.a), null, cream, () => 0.9);
            c.wbox(side, hole.c, hole.w + 0.16, hole.y0 - 0.05, hole.y0, 0, 0.07, cream);
            c.wbox(side, hole.c, hole.w + 0.12, hole.y1, hole.y1 + 0.06, 0, 0.03, cream);
            for (const sx of [-1, 1]) c.wbox(side, hole.c + sx * (hole.w / 2 + 0.03), 0.06, hole.y0, hole.y1, 0, 0.03, cream);
            if (def.id < hole.win.to) { c.wbox(side, hole.c, 0.04, hole.y0, hole.y1, -T / 2 - 0.015, -T / 2 + 0.015, cream); c.wbox(side, hole.c, hole.w, cy - 0.02, cy + 0.02, -T / 2 - 0.015, -T / 2 + 0.015, cream); }
          }
          from = hole.b;
        }
        piece(from, len, 0, topS, true);
      }
      for (const z of stairs) for (let k = 0; k <= z.run + 0.7; k += 0.45) { const p = wallPoint(def, z.door.side, z.door.c, k); reserved.push([p.x, p.z, z.door.w / 2 + 0.25]); }

      // the tubes: lit ones shine and light the room, dead ones are just grey, a few cannot decide
      if (opt.panels !== false) {
        const tube = lin(look.tube), on = c.shining('panel', kit.tex.panel(true), 2.5, tube), dead = c.mapped('dead', kit.tex.panel(false));
        const uv = [[0, 0], [1, 0], [1, 1], [0, 1]];
        /** (kit.gfx.fixtures) The sculpted light for panel p, on the ceiling plane over it: the housing in a batch of the
         * room's own, the louvre in one marked as detail, and the tubes and the inside of the pan into `glow`, the batch
         * the flat panel would have been drawn in (a dead light's grey tubes and darkened pan are lit by the room, with its
         * housing). None of it stands in the room:
         * nothing of it is gathered for the tubes' shadows, which take a lamp's fitting as casting nothing. */
        const fitting = (p, glow) => {
          const dead = p.state === 'dead', part = (name) => kit.model(`ceiling:${name}:${dead ? 'dead' : 'lit'}`, () => lightVox({ dead })[name], { ao: false }).solid;
          const into = voxBatch('fixture', { structural: true }), pan = panOf(part('housing'));
          mat.compose(vec.set(p.x, top(p.x, p.z), p.z), quat.identity(), scl.setScalar(VOX * CEILING.scale));
          into.addVox(pan.rest, mat);
          voxBatch('louvre', { structural: true, detail: true }).addVox(part('louvre'), mat, { tint: LOUVRE });
          if (dead) { into.addVox(pan.inside, mat, { tint: DARK_PAN }); into.addVox(part('tubes'), mat); }
          else { glow.addVox(pan.inside, mat, { uv: PAN_UV }); glow.addVox(part('tubes'), mat, { uv: TUBE_UV }); }
        };
        for (const p of def.panels) {
          const corner = (dx, dz) => [p.x + dx, top(p.x + dx * 0.98, p.z + dz * 0.98) - 0.006, p.z + dz];
          const q = [corner(-TILE / 2, -TILE), corner(TILE / 2, -TILE), corner(TILE / 2, TILE), corner(-TILE / 2, TILE)];
          const fit = opened.get(p) === 2, lay = (b) => (fit ? fitting(p, b) : b.quad(q[0], q[1], q[2], q[3], WHITE, uv));
          if (p.state === 'dead') { lay(dead); continue; }
          const y = top(p.x, p.z), head = clamp((y - floorAt(def, p.x, p.z)) / 2.6, 0.3, 2.5);
          const bank = rt.lighting ? panelBank(rt.lighting, p) : undefined;
          rt.lights.push(lamp(p.x, y - 0.14, p.z, tube.map((v) => v * 1.05 * def.light.power * Math.pow(head, 1.5)), { axis: [0, -1, 0], floor: 0.24, flick: p.state === 'flicker' && !rt.lighting, bank, k: 3.4 * (head < 1 ? head * head : head), far: 14 * Math.max(0.5, head) }));
          if (rt.lighting) { lay(c.shining(`panel-bank-${bank}`, kit.tex.panel(true), 2.5, tube)); continue; }
          if (p.state === 'on') { lay(on); continue; }
          const b = new Batch(); lay(b);
          const mesh = new THREE.Mesh(kit.plain(b), kit.glowing(kit.tex.panel(true), 2.5, tube));
          mesh.userData.on = mesh.material.color.clone();
          rt.flickers.push(mesh); rt.group.add(mesh);
        }
      }
      // light spilling in from a brighter room next door
      for (const dr of def.doors) {
        const other = world.rooms[dr.to], gap = other.level - rt.level;
        if (gap < 0.05) continue;
        const p = doorPoint(dr, -0.3), n = WALLS[dr.side].n;
        const spill = lamp(p.x, dr.sill + Math.min(1.45, dr.h * 0.7), p.z, lin(other.def.look.tube).map((v) => v * gap * 5.5 * (dr.w / 1.8) * Math.min(1, dr.h / 2) * (doorOn ? SPILL_DOOR : 1)), { axis: n, floor: 0.1, k: 3.2, wrap: 0.4 });
        spill.spill = dr.to;                     // (not a lamp of this room's: nothing standing here shadows it)
        rt.lights.push(spill);
      }
      // wall sockets, low down, here and there
      if (opt.sockets !== false && !def.crawl) for (let i = 0, nSock = R.int(1, 3); i < nSock; i++) {
        const spot = c.wallSpot(0.5, undefined, 0.35, 0.6); if (!spot) break;
        c.socket(spot.side, spot.at);
      }
      return c;
    },
    /**
     * A wall socket: the sculpted plate (wallfit.model.js), its middle at height y. Now and then something is plugged
     * into it, its lead hanging down to the skirting: which, is a hash of the room and the spot, so the seeded source is
     * not drawn on and the same seed has the same plugs (and never where the lead would go through the floor).
     */
    socket(side, at, y = 0.3) {
      let h = 2166136261;
      for (const ch of `${def.id}:${side}:${Math.round(at * 1000)}:${Math.round(y * 1000)}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
      const variant = y >= 0.25 && (h >>> 0) % 3 === 0 ? 1 : 0;
      wallFit(kit.model(`wallfit:socket:${variant}`, () => socketVox(variant), { ao: false }), c.wallAt(side, at, 0), y, c.flat, { uv: [0.5, 0.5] });
    },
    /** A block of wall standing in the room, floor to ceiling unless opt.h says otherwise (wallpapered, skirted, solid). */
    pillar(x, z, w, d, opt = {}) {
      const full = Math.max(ceilAt(def, x - w / 2, z - d / 2), ceilAt(def, x + w / 2, z - d / 2), ceilAt(def, x - w / 2, z + d / 2), ceilAt(def, x + w / 2, z + d / 2));
      const h = opt.h ?? full, y0 = opt.y0 || 0, wb = opt.batch || c.wall, trim = lin(look.trim);
      const faces = [[[x - w / 2, y0, z + d / 2], [1, 0, 0], w], [[x + w / 2, y0, z + d / 2], [0, 0, -1], d], [[x + w / 2, y0, z - d / 2], [-1, 0, 0], w], [[x - w / 2, y0, z - d / 2], [0, 0, 1], d]];
      let run = 0;
      for (const [o, U, len] of faces) {
        const start = run; run += len;
        wb.grid(o, U, UP, ticks(len, 0.5, Math.min(0.1, len / 3.2)), ticks(h - y0, 0.45, Math.min(0.16, (h - y0) / 3.2)), (u, v) => [(start + u) / 0.8, (y0 + v) / 0.8], opt.alb || WHITE, (u, v) => 0.82 + 0.18 * smooth(Math.min(y0 > 0.01 ? 9 : v, h - y0 - v) / 0.4));
      }
      if (h < full - 0.01) c.flat.box(x - w / 2, h - 0.001, z - d / 2, x + w / 2, h, z + d / 2, opt.cap || [0.5, 0.45, 0.36], { skip: '-y' });
      if (y0 > 0.01) c.ceil.grid([x - w / 2, y0, z - d / 2], [1, 0, 0], [0, 0, 1], [0, w], [0, d], (u, v) => [(x - w / 2 + u) / TILE, (z - d / 2 + v) / TILE], WHITE, () => 0.75);
      if (opt.skirting !== false && y0 < 0.01) c.flat.box(x - w / 2 - 0.02, 0, z - d / 2 - 0.02, x + w / 2 + 0.02, 0.11, z + d / 2 + 0.02, trim, { skip: '-y' });
      if (opt.solid !== false && y0 < 1.0) c.solid(x - w / 2, z - d / 2, x + w / 2, z + d / 2, { tall: h > 1.25, keep: true });
      if (gfxOn && ownBatch(wb)) standing.push({ x0: x - w / 2, y0, z0: z - d / 2, x1: x + w / 2, y1: h, z1: z + d / 2, placing, structural: wb === mapped.get('wall')?.batch });
      reserved.push([x, z, Math.hypot(w, d) / 2 + 0.15]);
    },
    /** A lit green sign over a doorway. */
    exitSign(dr, text = 'EXIT') {
      // Lettered to fit its plate, whatever it says: a long one ("EXIT (PROBABLY)") used to run off both ends. What is
      // in brackets goes underneath and smaller, as small print does. (Drawn at twice the old size, so that it is sharp.)
      const tex = kit.tex.custom('exit:2:' + text, 128, 40, (g, w, h) => {
        P(g, '#0d3a22', 0, 0, w, h); P(g, '#1f8a4e', 2, 2, w - 4, h - 4);
        g.fillStyle = '#eafff0'; g.textAlign = 'center'; g.textBaseline = 'middle';
        const fit = (line, most, least) => {
          let px = most;
          for (; px > least; px--) { g.font = `700 ${px}px ui-monospace, Menlo, Consolas, monospace`; if ((g.measureText ? g.measureText(line).width : line.length * px * 0.6) <= w - 14) break; }
          g.font = `700 ${px}px ui-monospace, Menlo, Consolas, monospace`;
        };
        const two = /^(.+?)\s*(\(.+\))$/.exec(text);
        if (two) { fit(two[1], 20, 9); g.fillText(two[1], w / 2, 13); fit(two[2], 13, 8); g.fillText(two[2], w / 2, 29); }
        else { fit(text, text.length > 8 ? 18 : text.length > 5 ? 22 : 28, 9); g.fillText(text, w / 2, h / 2 + 2); }
      }, { clamp: true });
      const p0 = doorPoint(dr, 0.05), y = Math.min(ceilAt(def, p0.x, p0.z) - 0.2, (dr.sill || 0) + (dr.h || 2.05) + 0.26), w = Math.min(dr.w - 0.2, 0.82);
      const p = c.hang(c.shining('exit' + text, tex, 1.9), dr.side, dr.c, y, w, w * 20 / 64, null, WHITE, 0.035);
      c.light(p.x + p.n[0] * 0.2, y, p.z + p.n[2] * 0.2, '#58e08c', 0.3, { k: 0.9, far: 4 });
      // the box behind the face (wallfit.model.js), as wide and as tall as the plain box it took the place of, hung from
      // that box's top edge; the face sits in its rib (in c.vox: its charge lamp shines)
      const bw = w + 0.04, bh = w * 0.36, half = w * 0.18;
      // (its conduit runs up to the ceiling over the sign, however low the sign hangs: to the centimetre, so signs at one drop share a model)
      const up = Math.max(0, Math.round((ceilAt(def, p0.x, p0.z) - (y + half)) * 100) / 100);
      wallFit(kit.model(`wallfit:exit:${bw.toFixed(4)}x${bh.toFixed(4)}^${up.toFixed(2)}`, () => exitBoxVox({ w: bw, h: bh, up }), { ao: false }), c.wallAt(dr.side, dr.c, 0), y + half, c.vox);
      // (kit.gfx: it stands in the room as that plain box did, 3 cm off the wall, so the tubes' shadows are as they were)
      if (gfxOn) {
        const hw = w / 2 + 0.02, U = p.U, n = p.n, cx = p.x - n[0] * 0.02, cz = p.z - n[2] * 0.02, ax = Math.abs(U[0]) * hw + Math.abs(n[0]) * 0.015, az = Math.abs(U[2]) * hw + Math.abs(n[2]) * 0.015;
        standing.push({ x0: cx - ax, y0: y - half, z0: cz - az, x1: cx + ax, y1: y + half, z1: cz + az, placing, structural: false });
      }
    },

    /* ---- done: bake and hand the meshes over ----------------------------------------- */
    /** The furniture sorted out, what darkens what worked out and the light map baked: the first half of finish, which
     * buildWorld runs in a slice of its own when there is a map to bake (finish then goes straight on to the meshes). */
    shade() {
      if (shaded) return;
      if (moving) separateFurniture();
      shaded = { g: kit.gfx && (kit.gfx.contact > 0 || kit.gfx.bounce > 0) ? gfxRoom() : null };
      if (mapOn) shadowRoom();
    },
    finish() {
      c.shade();
      const { g } = shaded;
      const add = (mesh, order = 0, parent = rt.group) => { mesh.renderOrder = order; mesh.matrixAutoUpdate = false; parent.add(mesh); return mesh; };
      const bake = (batch, make, order = 0, unlit = false, key = null) => {
        let last = null;
        for (const { batch: part, owner } of [{ batch }, ...(batches.get(batch)?.moving || [])]) {
          const probeLit = !unlit && owner?.lightTint;
          // (kit.gfx: the same bake, with the darkening and bounce worked out for this batch; what moves keeps only its own)
          const extra = g && !unlit && key ? gfxExtra(part, key, kit.gfx, owner ? g.moving : g) : null;
          const geo = unlit ? kit.plain(part)
            : extra ? (probeLit ? kit.geometry(part, [], WHITE, null, extra) : kit.geometry(part, rt.lights, rt.amb, rt.lighting, extra))
            : probeLit ? kit.geometry(part, [], WHITE) : kit.geometry(part, rt.lights, rt.amb, rt.lighting);
          if (geo) {
            const material = make(geo, owner);
            if (probeLit) {
              material.uniforms.uDim = {value:1}; material.uniforms.uFlick = {value:1};
              material.uniforms.uTint.value = owner.lightTint; material.userData.furnitureLight = true;
            }
            last = add(new THREE.Mesh(geo, material), order, owner?.group || rt.group);
            if (batch.detail) last.userData.detail = true;            // (c.detail: hidden at a low Graphics setting)
          }
        }
        return last;
      };
      for (const [key, m] of mapped) {
        bake(m.batch, (geo, owner) => kit.surface({ map: m.texture, room: rt.u, flick: geo.userData.flick, banks: geo.userData.banks, cutout: m.cutout, side: m.side, lm: owner ? null : rt.lm }), 0, false, key);
      }
      bake(c.vox, (geo, owner) => kit.surface({ vox: true, room: rt.u, flick: geo.userData.flick, banks: geo.userData.banks, lm: owner ? null : rt.lm }), 0, false, 'vox');
      for (const [key, b] of voxed) bake(b, (geo, owner) => kit.surface({ vox: true, room: rt.u, flick: geo.userData.flick, banks: geo.userData.banks, lm: owner ? null : rt.lm }), 0, false, key);
      bake(c.glass, geo => kit.surface({ vox: true, room: rt.u, flick: geo.userData.flick, banks: geo.userData.banks, alpha: 0.42 }), 3);
      for (const [key, m] of shining) {
        const mesh = bake(m.batch, () => kit.glowing(m.texture, m.power, m.rgb, m.opt), 0, true);
        if (key === 'panel' && mesh) { rt.panelMesh = mesh; rt.panelOn = mesh.material.color.clone(); }
        if (key.startsWith('panel-bank-') && mesh) { mesh.userData.bank = Number(key.at(-1)); mesh.userData.on = mesh.material.color.clone(); rt.bankPanels.push(mesh); }
      }
      for (const { q, parent } of [{ q: c.decals, parent: rt.group }, ...furnitureGroups.map(f => ({ q: f.decals, parent: f.group }))]) {
        if (!q.idx.length) continue;
        const geo = kit.own(new THREE.BufferGeometry());
        geo.setAttribute('position', new THREE.Float32BufferAttribute(q.pos, 3));
        geo.setAttribute('uv', new THREE.Float32BufferAttribute(q.uv, 2));
        geo.setAttribute('color', new THREE.Float32BufferAttribute(q.col, 4));
        geo.setIndex(q.idx);
        add(new THREE.Mesh(geo, kit.own(new THREE.MeshBasicMaterial({ map: kit.tex.blob(), vertexColors: true, transparent: true, depthWrite: false }))), 1, parent);
      }
      rt.group.updateMatrixWorld(true);
      for (const fn of c.after) fn();
      if (moving) for (const object of added) {
        if (object.userData.movable) continue;
        object.updateMatrixWorld(true);
        // Added objects and c.dynamic holders are authored in room space.
        // Measure there, so a quarter-turned room does not change ownership.
        const box = new THREE.Box3();
        object.traverse(child => {
          if (!child.geometry?.attributes?.position) return;
          child.geometry.computeBoundingBox();
          const local = new THREE.Matrix4().copy(rt.group.matrixWorld).invert().multiply(child.matrixWorld);
          box.union(child.geometry.boundingBox.clone().applyMatrix4(local));
        });
        if (box.isEmpty()) continue;
        const foot = { x0: box.min.x, z0: box.min.z, x1: box.max.x, z1: box.max.z, bottom: box.min.y, top: box.max.y };
        const f = furnitureGroups.find(f => f.type !== 'chair' && onFurniture(f.placement.foot, foot));
        if (f) { f.group.add(object); object.traverse(o => o.userData.followFurnitureLight?.(f)); f.top = Math.max(f.top, (def.y || 0) + foot.top); }
      }
      for (const f of furnitureGroups) f.group.updateMatrixWorld(true);
    },
    /** Hooks run once the light is baked (so moving things can ask how bright their spot is). */
    after: [],
  };
  return c;
}

export { WALLS };
