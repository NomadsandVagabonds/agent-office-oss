// The Backrooms — things half inside the structure (a preview: docs/BLOCKROOMS-PREVIEWS.md "Clipping").
//
// An ordinary object put down so that part of it is inside a wall, the floor or the ceiling: a chair two-thirds through
// a wall, a desk sunk to its top in the carpet, a filing cabinet coming out of the ceiling upside down. The part inside
// is cut off the geometry once, at build time, a centimetre behind the surface it went into (the shell's walls are one
// sheet each and rooms stand 20 cm apart, so nothing of it reaches the next room or the void outside); what is left is
// put down with c.place into the room's own voxel batch, so it is baked, lit and shadowed like everything else and costs
// nothing a frame. It is solid only where it stands in open space, and not at all where that would narrow the way to a
// doorway. Nothing of it reads the room's seeded stream: where it goes is the caller's to say, from what the room
// already rolled.
//
//   clip(c, what, x, z, opt)   what: a catalogue type ('chair', 'desk', 'cabinet'…) or a meshed model { solid, glass, bounds }
//     opt: rot, y, tilt, flip, scale, o, tint (as c.place / c.prop) · cut: extra planes [{ n, d }] (keep n·p ≤ d, the
//     room's frame), beyond the room's own shell · solid (default true: where it stands in open space) · shadow
//     → { foot (what is left, in the room's frame), solid (its collider, or null), cut (triangles cut away), why }
import * as THREE from 'three';

export const CLIP = Object.freeze({
  into: 0.01,        // how far behind the surface the cut lies: hidden by it, and well short of the 20 cm to the next room
  grid: 0.0125,      // positions snapped to the level's half-size voxel
  lane: 0.35,        // a doorway's lane: its width and this much either side…
  laneDeep: 1.3,     // …this far into the room, kept clear of anything solid
  foot: [0.25, 1.0], // a thing is only solid where some of it is between these heights (as c.place has it)
});

const VOX = 0.025;
const snap = (v) => Math.round(v / CLIP.grid) * CLIP.grid;

/** The room's own shell as planes to keep inside of: its four walls, the floor and the ceiling, each `into` behind its face. */
export function shellPlanes(W, D, H, into = CLIP.into) {
  return [
    { n: [1, 0, 0], d: W / 2 + into }, { n: [-1, 0, 0], d: W / 2 + into },
    { n: [0, 0, 1], d: D / 2 + into }, { n: [0, 0, -1], d: D / 2 + into },
    { n: [0, -1, 0], d: into }, { n: [0, 1, 0], d: H + into },
  ];
}

/** The matrix c.place puts a model down with (model voxels → the room's frame, metres). */
export function placeMatrix(x, z, opt = {}) {
  const s = Array.isArray(opt.scale) ? opt.scale : [opt.scale || 1, opt.scale || 1, opt.scale || 1];
  const q = opt.quat ? opt.quat.clone() : new THREE.Quaternion().setFromEuler(new THREE.Euler(opt.tilt ? opt.tilt[0] : 0, opt.rot || 0, (opt.flip ? Math.PI : 0) + (opt.tilt ? opt.tilt[1] : 0), 'YXZ'));
  return new THREE.Matrix4().compose(new THREE.Vector3(x, opt.y || 0, z), q, new THREE.Vector3(VOX * s[0] * (opt.mirror ? -1 : 1), VOX * s[1], VOX * s[2]));
}

/** Planes in the room's frame, carried into a model's own (n·(M m) ≤ d  ⇔  (Aᵀn)·m ≤ d − n·t). */
export function toModel(planes, m) {
  const e = m.elements;            // column-major: A's columns are e[0..2], e[4..6], e[8..10]; t is e[12..14]
  return planes.map(({ n, d }) => ({
    n: [n[0] * e[0] + n[1] * e[1] + n[2] * e[2], n[0] * e[4] + n[1] * e[5] + n[2] * e[6], n[0] * e[8] + n[1] * e[9] + n[2] * e[10]],
    d: d - (n[0] * e[12] + n[1] * e[13] + n[2] * e[14]),
  }));
}

/**
 * A meshed voxel geometry with everything outside the planes cut away (Sutherland–Hodgman, triangle by triangle, every
 * attribute carried along the cut edge). Triangles wholly inside keep their vertices; wholly outside, they go.
 * → { geo (null when nothing is left), cut (triangles that lost something), kept (triangles out) }
 */
export function cutGeometry(geo, planes) {
  if (!geo) return { geo: null, cut: 0, kept: 0 };
  const names = Object.keys(geo.attributes), attrs = names.map((k) => geo.attributes[k]);
  const sizes = attrs.map((a) => a.itemSize), out = names.map(() => []), idx = [];
  const P = geo.attributes.position, index = geo.index ? geo.index.array : null, n = index ? index.length : P.count;
  const side = (i) => planes.map(({ n: q, d }) => q[0] * P.getX(i) + q[1] * P.getY(i) + q[2] * P.getZ(i) - d);
  const dist = new Array(P.count);
  for (let i = 0; i < P.count; i++) dist[i] = side(i);
  const reuse = new Map();
  let count = 0, cut = 0;
  const vertexOf = (vals) => { vals.forEach((v, k) => out[k].push(...v)); return count++; };
  const original = (i) => {
    if (!reuse.has(i)) reuse.set(i, vertexOf(attrs.map((a, k) => { const r = []; for (let s = 0; s < sizes[k]; s++) r.push(a.array[i * sizes[k] + s]); return r; })));
    return reuse.get(i);
  };
  for (let t = 0; t + 2 < n; t += 3) {
    const tri = index ? [index[t], index[t + 1], index[t + 2]] : [t, t + 1, t + 2];
    const inside = tri.map((i) => dist[i].every((v) => v <= 1e-9));
    if (inside.every(Boolean)) { idx.push(...tri.map(original)); continue; }
    if (planes.some((_, p) => tri.every((i) => dist[i][p] > 1e-9))) { cut++; continue; }
    cut++;
    // the polygon, as attribute values, clipped plane by plane
    let poly = tri.map((i) => ({ d: dist[i], v: attrs.map((a, k) => { const r = []; for (let s = 0; s < sizes[k]; s++) r.push(a.array[i * sizes[k] + s]); return r; }) }));
    for (let p = 0; p < planes.length && poly.length; p++) {
      const next = [];
      for (let k = 0; k < poly.length; k++) {
        const a = poly[k], b = poly[(k + 1) % poly.length], da = a.d[p], db = b.d[p];
        if (da <= 1e-9) next.push(a);
        if ((da <= 1e-9) !== (db <= 1e-9)) {
          const f = da / (da - db);
          next.push({ d: a.d.map((v, j) => v + (b.d[j] - v) * f), v: a.v.map((arr, j) => arr.map((x, s) => x + (b.v[j][s] - x) * f)) });
        }
      }
      poly = next;
    }
    if (poly.length < 3) continue;
    const ids = poly.map((q) => vertexOf(q.v));
    for (let k = 1; k + 1 < ids.length; k++) idx.push(ids[0], ids[k], ids[k + 1]);
  }
  if (!idx.length) return { geo: null, cut, kept: 0 };
  const g = new THREE.BufferGeometry();
  names.forEach((k, j) => g.setAttribute(k, new THREE.Float32BufferAttribute(out[j], sizes[j])));
  g.setIndex(idx);
  return { geo: g, cut, kept: idx.length / 3 };
}

/** The bounds of a geometry, in its own units, as meshVox gives them. */
function boundsOf(geo) {
  const b = { x0: Infinity, y0: Infinity, z0: Infinity, x1: -Infinity, y1: -Infinity, z1: -Infinity }, p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    b.x0 = Math.min(b.x0, x); b.y0 = Math.min(b.y0, y); b.z0 = Math.min(b.z0, z); b.x1 = Math.max(b.x1, x); b.y1 = Math.max(b.y1, y); b.z1 = Math.max(b.z1, z);
  }
  return b;
}

/** Where a geometry really is once put down with m: the box round its vertices, in the room's frame. */
export function roomBox(geo, m) {
  const p = geo.attributes.position, v = new THREE.Vector3(), b = { x0: Infinity, y0: Infinity, z0: Infinity, x1: -Infinity, y1: -Infinity, z1: -Infinity };
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).applyMatrix4(m);
    b.x0 = Math.min(b.x0, v.x); b.y0 = Math.min(b.y0, v.y); b.z0 = Math.min(b.z0, v.z); b.x1 = Math.max(b.x1, v.x); b.y1 = Math.max(b.y1, v.y); b.z1 = Math.max(b.z1, v.z);
  }
  return b;
}

/** The strip in front of each doorway that a body walks in by: its width and `lane` either side, `laneDeep` into the room. */
export function doorLanes(room) {
  const { W, D } = room;
  return room.doors.map((dr) => {
    const half = dr.w / 2 + CLIP.lane;
    if (dr.side === 'front') return { x0: dr.c - half, x1: dr.c + half, z0: D / 2 - CLIP.laneDeep, z1: D / 2 };
    if (dr.side === 'back') return { x0: dr.c - half, x1: dr.c + half, z0: -D / 2, z1: -D / 2 + CLIP.laneDeep };
    if (dr.side === 'left') return { x0: -W / 2, x1: -W / 2 + CLIP.laneDeep, z0: dr.c - half, z1: dr.c + half };
    return { x0: W / 2 - CLIP.laneDeep, x1: W / 2, z0: dr.c - half, z1: dr.c + half };
  });
}
const meets = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.z0 < b.z1 && b.z0 < a.z1;

/**
 * What of a thing put down at `box` (the room's frame) may be solid: the part of its footprint in open space, or null —
 * when nothing of it is at a body's height, or when it would narrow a doorway's lane. Pure.
 */
export function solidPart(box, room) {
  const { W, D } = room, [lo, hi] = CLIP.foot;
  if (!(box.y0 < hi && box.y1 > lo)) return { rect: null, why: 'out of reach' };
  const rect = { x0: Math.max(box.x0, -W / 2), z0: Math.max(box.z0, -D / 2), x1: Math.min(box.x1, W / 2), z1: Math.min(box.z1, D / 2) };
  if (rect.x1 - rect.x0 < 0.02 || rect.z1 - rect.z0 < 0.02) return { rect: null, why: 'all inside' };
  if (doorLanes(room).some((l) => meets(rect, l))) return { rect: null, why: 'a doorway' };
  return { rect, why: 'open space' };
}

/** The model c.prop would put down for a catalogue type, or a model handed over as it is. */
function modelOf(c, what, o) {
  if (typeof what !== 'string') return { geo: what, scale: 1 };
  return c.propModel(what, o);
}

/** Put `what` down at (x, z) with whatever of it is inside the structure cut away. See the head of this file. */
export function clip(c, what, x, z, opt = {}) {
  const got = modelOf(c, what, opt.o);
  if (!got?.geo?.solid) return null;
  const k = got.scale || 1, scale = Array.isArray(opt.scale) ? opt.scale.map((v) => v * k) : (opt.scale || 1) * k;
  const at = { ...opt, scale, y: snap(opt.y || 0) };
  const px = snap(x), pz = snap(z), m = placeMatrix(px, pz, at);
  const planes = [...shellPlanes(c.W, c.D, c.H), ...(opt.cut || [])], local = toModel(planes, m);
  const solid = cutGeometry(got.geo.solid, local), glass = cutGeometry(got.geo.glass, local);
  if (!solid.geo) return null;
  const geo = { solid: solid.geo, glass: glass.geo, bounds: boundsOf(solid.geo) };
  c.place(geo, px, pz, { rot: at.rot, y: at.y, tilt: at.tilt, flip: at.flip, quat: at.quat, mirror: at.mirror, scale, tint: opt.tint, mono: opt.mono, solid: false, shadow: false });
  const box = roomBox(solid.geo, m), part = opt.solid === false ? { rect: null, why: 'asked' } : solidPart(box, c.room);
  const col = part.rect ? c.solid(part.rect.x0, part.rect.z0, part.rect.x1, part.rect.z1, { tall: box.y1 > 1.25, top: box.y1 }) : null;
  // its contact shadow: on the carpet where it comes down to the floor, on the tiles where it comes out of the ceiling,
  // kept inside the room's walls
  if (opt.shadow !== false) {
    const pad = 0.12, x0 = Math.max(box.x0 - pad, -c.W / 2), x1 = Math.min(box.x1 + pad, c.W / 2), z0 = Math.max(box.z0 - pad, -c.D / 2), z1 = Math.min(box.z1 + pad, c.D / 2);
    if (x1 > x0 && z1 > z0) {
      if (box.y0 < 0.3) c.blot((x0 + x1) / 2, (z0 + z1) / 2, x1 - x0, z1 - z0, { a: opt.shadow || 0.5 });
      if (box.y1 > c.H - 0.3) c.blot((x0 + x1) / 2, (z0 + z1) / 2, x1 - x0, z1 - z0, { a: 0.35, down: true, y: c.H - 0.004 });
    }
  }
  const out = { what: typeof what === 'string' ? what : 'model', x: px, z: pz, foot: box, solid: col, cut: solid.cut + glass.cut, kept: solid.kept, why: part.why };
  (c.rt.clipped ||= []).push(out);                // (for the dev page, the pictures and the tests: what was put where)
  return out;
}

/** Is a preview asked for (the dev page's &preview=clip)? Off everywhere else, the game included. */
export const previewing = (c, name) => !!c.env?.preview?.has?.(name);
