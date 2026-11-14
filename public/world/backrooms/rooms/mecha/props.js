import { Vox, M } from '../../../vox/vox.js';

// Repeated institutional furniture: broad wood surfaces keep greedy meshing
// efficient while the native voxel edges and baked occlusion retain the style.
function trainingDesk() {
  const v = new Vox();
  const wood = M('#88784e', 0), edge = M('#665b3e', 0);
  const metal = M('#8a8d78', 0);
  v.box(-32, 29, -16, 32, 31, 16, wood);
  for (const x of [-30, 28]) for (const z of [-14, 12]) {
    v.box(x, 0, z, x + 2, 29, z + 2, metal);
  }
  // One long, shallow drawer facing the seated worker on the -Z side.
  v.box(12, 22, -13, 26, 29, -5, edge);
  v.paint(13, 23, -13, 25, 28, -12, wood);
  v.box(17, 25, -14, 22, 26, -13, metal);
  return v;
}

/** Native voxel desk, top .78 m, worker seated on its local -Z side. */
export function createTrainingDesk(c, x, z, rot = 0) {
  return c.model('mecha:training-desk:v1', trainingDesk, x, z, {
    rot, scale: [1, .78 / (31 * .025), 1], solid: false, shadow: false,
  });
}

function conditioningSeat() {
  const v = new Vox();
  const steel = M('#53574e', 0), pad = M('#393c34', 0);
  const strap = M('#322d25', 0), buckle = M('#858575', 0);
  // A bolted steel plinth and rigid upright: equipment, with no wheels or tilt.
  // The uninterrupted base avoids the dense occlusion seams of four thin legs.
  v.box(-11, 0, -11, 11, 44, -8, steel);
  v.box(-11, 0, -8, 11, 19, 11, steel);
  v.paint(-11, 17, -8, 11, 19, 11, pad);
  v.paint(-10, 21, -9, 10, 43, -8, pad);
  // Broad straps stay on the voxel faces rather than adding separate meshes.
  v.paint(-11, 18, 4, 11, 19, 7, strap);
  v.paint(-2, 18, 4, 2, 19, 7, buckle);
  v.paint(-11, 29, -9, 11, 32, -8, strap);
  v.paint(-2, 29, -9, 2, 32, -8, buckle);
  return v;
}

/** Floor-bolted conditioning seat: seat .475m, back 1.1m, facing +Z. */
export function createConditioningSeat(c, x, z, rot = 0, { solid = false } = {}) {
  return c.model('mecha:conditioning-seat:v1', conditioningSeat, x, z, {
    rot, solid, shadow: false,
  });
}

function taskMonitor() {
  const v = new Vox();
  const cream = M('#a8a58c', 0), base = M('#696c5b', 0);
  const screen = M('#1c2923', 0), phosphor = M('#617a58', 0, { glow: true });
  v.box(-9, 0, -9, 9, 18, 7, cream);
  v.paint(-9, 0, -9, 9, 2, 7, base);
  v.paint(-7, 5, 6, 7, 16, 7, screen);
  v.paint(-5, 12, 6, 4, 13, 7, phosphor);
  v.paint(-5, 9, 6, 1, 10, 7, phosphor);
  v.paint(6, 3, 6, 7, 4, 7, base);
  return v;
}

/** A compact .45m CRT, screen facing local +Z, batched into the room. */
export function createTaskMonitor(c, x, z, rot = 0, y = .78) {
  return c.model('mecha:task-monitor:v1', taskMonitor, x, z, {
    rot, y, solid: false, shadow: false,
  });
}
