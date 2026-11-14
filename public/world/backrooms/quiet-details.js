// Static details for the optional quiet-maze study. Pure plans in room coordinates.
import { DESK } from '../props/office.js';
import { VOXEL } from '../vox/vox.js';

const BODY_PAD = 0.225, SUNK = -0.4;
// Native catalogue bounds, in voxels. Tests compare these against the actual
// sculptures; planning a desk does not need to build or mesh its voxel field.
const BOUNDS = {
  desk: [-32, 0, -16, 32, 26, 16], chair: [-13, 0, -10, 13, 39, 10],
  crt: [-10, 0, -9, 10, 20, 9], keyboard: [-12, 0, -4, 12, 3, 4], mouse: [-2, 0, -3, 2, 3, 9],
};
const zero = v => v === 0 ? 0 : v;
const turnOf = n => ((n % 4) + 4) % 4;
function rotate(p, turn) {
  let { x, z } = p;
  if (turn === 1) [x, z] = [z, -x];
  if (turn === 2) [x, z] = [-x, -z];
  if (turn === 3) [x, z] = [-z, x];
  return { ...p, x: zero(x), z: zero(z) };
}
function rectangle(p, turn) {
  return { ...rotate(p, turn), w: turn % 2 ? p.d : p.w, d: turn % 2 ? p.w : p.d };
}
function bounds(p) {
  return { x0: p.x - p.w / 2, z0: p.z - p.d / 2, x1: p.x + p.w / 2, z1: p.z + p.d / 2 };
}
function prop(type, x, z, y, quarterTurn, host = null) {
  const b = BOUNDS[type], corners = [];
  for (const vx of [b[0], b[3]]) for (const vz of [b[2], b[5]]) corners.push(rotate({ x: vx * VOXEL, z: vz * VOXEL }, quarterTurn));
  return {
    id: type, type, x, z, y, rot: quarterTurn * Math.PI / 2, host,
    bounds: { x0: x + Math.min(...corners.map(p => p.x)), z0: z + Math.min(...corners.map(p => p.z)),
      x1: x + Math.max(...corners.map(p => p.x)), z1: z + Math.max(...corners.map(p => p.z)),
      bottom: y + b[1] * VOXEL, top: y + b[4] * VOXEL },
  };
}

/** Return explicit wall fragments, clearance volumes and native prop placements.
 * The caller's room/pillars remain untouched. No doors, events, light or loot are added.
 */
export function planQuietDetails(room) {
  const { W, D, H } = room, { variant = 0, turn: rawTurn = 0, detail = null } = room.quietStudy || {};
  const turn = turnOf(rawTurn);
  const plan = { detail, variant, turn, basePillars: room.pillars.map(p => ({ ...p })), fragments: [], openings: [], headClearance: [], props: [], probes: [] };
  if (detail === null) return plan;
  if (detail === 'apertures') {
    if (variant !== 0) throw new RangeError('Quiet apertures require the parallel-wall motif.');
    const reach = Math.min(W, D) / 2 - 1.5, end = reach - 1.1;
    const whole = rectangle({ x: -0.9, z: -0.55, w: 0.2, d: 2 * reach - 1.1 }, turn);
    const index = plan.basePillars.findIndex(p => ['x', 'z', 'w', 'd'].every(k => Math.abs(p[k] - whole[k]) < 1e-7));
    if (index < 0 || end <= 1.6 || H <= 2.3) throw new RangeError('Quiet aperture wall does not fit this room.');
    plan.basePillars.splice(index, 1);
    const fragment = (a, b, y0, h) => plan.fragments.push(rectangle({ x: -0.9, z: (a + b) / 2, w: 0.2, d: b - a, y0, h }, turn));
    fragment(-reach, -2.2, 0, H);
    fragment(-2.2, -1.0, 0.85, H); // lintel only: the carpet continues through
    fragment(-1.0, 0.4, 0, H);
    fragment(0.4, 1.6, 0, 1.7);
    fragment(0.4, 1.6, 2.3, H);
    fragment(1.6, end, 0, H);
    for (const opening of [{ kind: 'crawl', z: -1.6, y0: 0, h: 0.85 }, { kind: 'high', z: 1, y0: 1.7, h: 2.3 }]) {
      const o = rectangle({ ...opening, x: -0.9, w: 0.2, d: 1.2 }, turn);
      plan.openings.push({ ...o, normal: rotate({ x: 1, z: 0 }, turn) });
      for (const dx of [-0.65, 0.65]) plan.probes.push(rotate({ x: -0.9 + dx, z: opening.z, kind: opening.kind }, turn));
    }
    const clearance = rectangle({ x: -0.9, z: -1.6, w: 0.2 + 2 * BODY_PAD, d: 1.2 }, turn);
    plan.headClearance.push({ ...bounds(clearance), height: 0.85 });
    plan.probes.push({ ...rotate({ x: -0.9, z: -1.6 }, turn), kind: 'crawl-center' });
  } else if (detail === 'sunken') {
    if (variant !== 1) throw new RangeError('The sunken desk belongs in the dogleg motif.');
    const center = { x: -2.4, z: -1.1 }, deskTurn = turnOf(turn + 1);
    const desk = rotate(center, turn), chair = rotate({ x: -3.35, z: -1.1 }, turn);
    plan.props.push(prop('desk', desk.x, desk.z, SUNK, deskTurn), prop('chair', chair.x, chair.z, SUNK, deskTurn));
    for (const [type, anchor, localTurn] of [['crt', DESK.monitor, 2], ['keyboard', DESK.keyboard, 2], ['mouse', DESK.mouse, 0]]) {
      const offset = rotate({ x: anchor[0] * VOXEL, z: anchor[2] * VOXEL }, 1);
      const at = rotate({ x: center.x + offset.x, z: center.z + offset.z }, turn);
      plan.props.push(prop(type, at.x, at.z, SUNK + anchor[1] * VOXEL, turnOf(deskTurn + localTurn), 'desk'));
    }
    for (const p of [{ x: -4.1, z: -1.1 }, { x: -2.4, z: -2.5 }, { x: -2.4, z: 0.4 }]) plan.probes.push({ ...rotate(p, turn), kind: 'desk-route' });
  } else throw new RangeError(`Unknown quiet detail: ${detail}`);
  return plan;
}
