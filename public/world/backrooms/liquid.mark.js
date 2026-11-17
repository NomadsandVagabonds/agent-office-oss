// The Backrooms — water: the mark (world.js `c.liquid`; liquid.js draws it). A room marks a sheet it has drawn as a
// liquid's surface; once the room is built (c.after) the mark finds its mesh(es) and measures them in the room's frame,
// and that is all, at every tier: nothing is made and the room's sheet is exactly as it was. No three.js is imported
// here (the rooms' own tests load world.js, and with it this, as plain modules): the matrices are the meshes' own.
import { flatness } from './liquid.rule.js';

// (what c.liquid hands back: the wake is to come, so it does nothing yet, at any tier)
const STILL = Object.freeze({ disturb() {} });

/**
 * c.liquid (world.js): mark what a room drew as a liquid's surface. Records the mark in rt.liquids; at c.after time it
 * finds the mesh(es) and measures them. → a handle { disturb() } that does nothing yet.
 */
export function markLiquid(c, target, opt = {}) {
  const rt = c.rt;
  const phase = opt.phase && typeof opt.phase === 'object' && 'value' in opt.phase ? opt.phase : Number.isFinite(opt.phase) ? { value: opt.phase } : null;
  const rec = { kind: opt.kind || 'water', phase, flow: opt.flow ?? null, y: Number.isFinite(opt.y) ? opt.y : null,
    rt, kit: c.kit, target, meshes: [], toRoom: [], plane: null, state: 'marked', reason: null, pairs: null, under: false, live: false };
  (rt.liquids ||= []).push(rec);
  c.after?.push?.(() => settleLiquid(rec));
  return STILL;
}

const isBatch = (t) => !!t && Array.isArray(t.pos) && Array.isArray(t.idx) && !t.isObject3D;
/** The meshes a mark means, in the room's group: the mesh itself, the meshes in a group, or the mesh drawn from a batch. */
export function liquidMeshes(target, group) {
  if (!target) return [];
  if (target.isMesh) return [target];
  if (target.isObject3D) { const out = []; target.traverse((o) => { if (o.isMesh) out.push(o); }); return out; }
  if (isBatch(target) && group) {
    // (the kit's geometry is a copy of the batch's corners, so the mesh is the one whose corners are exactly those)
    const n = target.pos.length, out = [];
    group.traverse((o) => {
      const p = o.isMesh ? o.geometry?.attributes?.position : null;
      if (!p || p.array.length !== n || out.length) return;
      for (let i = 0; i < n; i++) if (p.array[i] !== Math.fround(target.pos[i])) return;
      out.push(o);
    });
    return out;
  }
  return [];
}

/** Once the room is built: the mark's meshes, where they sit in the room's frame, and whether they are flat. */
export function settleLiquid(rec) {
  const group = rec.rt.group, meshes = liquidMeshes(rec.target, group);
  rec.target = null;                                     // (a batch is let go of: its mesh is found)
  if (!meshes.length) { rec.state = 'refused'; rec.reason = 'nothing drawn'; return rec; }
  let lo = Infinity, hi = -Infinity;
  for (const mesh of meshes) {
    // (the mesh may have been put in its holder after the room's matrices were worked out: from its own chain up. The
    // matrix is one of the mesh's own kind, so that nothing here needs three.js itself)
    const m = mesh.matrix.clone().identity();
    let o = mesh;
    for (; o && o !== group; o = o.parent) { if (o.matrixAutoUpdate) o.updateMatrix(); m.premultiply(o.matrix); }
    if (o !== group) { rec.state = 'refused'; rec.reason = 'not in the room'; return rec; }
    const p = mesh.geometry?.attributes?.position;
    if (!p) { rec.state = 'refused'; rec.reason = 'nothing drawn'; return rec; }
    const e = m.elements;
    for (let i = 0; i < p.count; i++) { const y = e[1] * p.getX(i) + e[5] * p.getY(i) + e[9] * p.getZ(i) + e[13]; lo = Math.min(lo, y); hi = Math.max(hi, y); }
    rec.toRoom.push(m.toArray());
  }
  const f = flatness(lo, hi);
  rec.meshes = meshes; rec.plane = { y: f.y, height: f.height };
  if (!f.flat) { rec.state = 'refused'; rec.reason = 'not flat'; return rec; }
  (group.userData.liquids ||= []).push(rec);
  return rec;
}

/** Every flat mark under `scene`: in its rooms (a part's scene) or its parts' rooms (the scene everything hangs in). */
export function collectLiquids(scene, out = []) {
  const take = (o) => { const l = o.userData?.liquids; if (l) for (const r of l) out.push(r); };
  if (!scene) return out;
  take(scene);
  for (const a of scene.children) { take(a); for (const b of a.children) take(b); }
  return out;
}
