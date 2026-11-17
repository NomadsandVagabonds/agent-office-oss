// The Backrooms — what a room may cost (docs/BACKROOMS.md, "What a room may cost"), as numbers, and the counting that
// goes with them. A room's ordinary batches are what a weak machine always draws; its detail batches (world.js
// `c.detail`, or `detail: true` to c.mapped and c.shining: mesh.userData.detail) are what a low Graphics setting leaves
// out. No three.js in here: the dev page's &check=1 and the tests both count with it.

export const ROOM_BUDGET = Object.freeze({
  room: Object.freeze({ ordinaryTriangles: 120000, allTriangles: 250000, meshes: 45, detailMeshes: 12, lights: 16 }),
  setPiece: Object.freeze({ ordinaryTriangles: 240000, allTriangles: 500000, meshes: 45, detailMeshes: 12, lights: 16 }),
});

const trianglesOf = (g) => Math.round((g.index ? g.index.count : g.attributes?.position ? g.attributes.position.count : 0) / 3);

/** Everything drawn under `object`, split: ordinary meshes and triangles, and those marked as detail. */
export function roomCost(object) {
  const cost = { meshes: 0, triangles: 0, detailMeshes: 0, detailTriangles: 0 };
  object?.traverse?.((o) => {
    if (!o.isMesh || !o.geometry) return;
    if (o.userData?.detail) { cost.detailMeshes++; cost.detailTriangles += trianglesOf(o.geometry); }
    else { cost.meshes++; cost.triangles += trianglesOf(o.geometry); }
  });
  return cost;
}

/** What is over budget, in words; [] when nothing is. `lights`: how many the room has. `setPiece`: the only one on its floor. */
export function overBudget(cost, { lights = 0, setPiece = false } = {}) {
  const b = setPiece ? ROOM_BUDGET.setPiece : ROOM_BUDGET.room, out = [];
  if (cost.triangles > b.ordinaryTriangles) out.push(`${cost.triangles} triangles in its ordinary batches (at most ${b.ordinaryTriangles})`);
  if (cost.triangles + cost.detailTriangles > b.allTriangles) out.push(`${cost.triangles + cost.detailTriangles} triangles in all (at most ${b.allTriangles})`);
  if (cost.meshes > b.meshes) out.push(`${cost.meshes} meshes (at most ${b.meshes})`);
  if (cost.detailMeshes > b.detailMeshes) out.push(`${cost.detailMeshes} detail meshes (at most ${b.detailMeshes})`);
  if (lights > b.lights) out.push(`${lights} lights (at most ${b.lights})`);
  return out;
}
