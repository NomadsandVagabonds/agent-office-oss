// Builder used only by the opt-in study. Everything here is static and baked.
import { headAt } from './gen.js';
import { planQuietDetails } from './quiet-details.js';

export function buildQuietRoom(c) {
  const plan = planQuietDetails(c.room);
  const state = { ...plan, renderedProps: [], skippedProps: [] };
  c.rt.quietDetails = state;
  c.shell();
  for (const p of plan.basePillars) c.pillar(p.x, p.z, p.w, p.d);
  for (const p of plan.fragments) {
    // Explicit collision avoids c.pillar's automatic full footprint on a low
    // header. h is its absolute top; y0 is its bottom, not a translated height.
    c.pillar(p.x, p.z, p.w, p.d, { y0: p.y0, h: p.h, solid: false });
    if (p.y0 === 0) c.solid(p.x - p.w / 2, p.z - p.d / 2, p.x + p.w / 2, p.z + p.d / 2, { tall: p.h > 1.25, keep: true });
  }
  if (plan.headClearance.length) {
    const previous = c.rt.headY;
    c.rt.headY = (x, z) => {
      let head = previous ? previous(x, z) : headAt(c.room, x, z);
      for (const b of plan.headClearance) if (x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1) head = Math.min(head, b.height);
      return head;
    };
  }
  const placed = new Set();
  for (const p of plan.props) {
    // Preflight the actual catalogue geometry: c.prop alone can substitute a
    // wooden crate after a missing or failed recipe, which is wrong here.
    if ((p.host && !placed.has(p.host)) || !c.hasProp(p.type) || !c.env.catalogue.geo(p.type)) {
      state.skippedProps.push(p.id);
      continue;
    }
    const foot = c.prop(p.type, p.x, p.z, { y: p.y, rot: p.rot, solid: false, shadow: false });
    if (!foot) { state.skippedProps.push(p.id); continue; }
    placed.add(p.id);
    state.renderedProps.push({ ...p, foot });
    // The .25m desk top is still a physical object. Entirely buried geometry
    // does not block the floor; stacked peripherals share their desk's space.
    if (foot.top > 0.005) c.solid(foot.x0, foot.z0, foot.x1, foot.z1, { tall: foot.top > 1.25, keep: true });
  }
  return state;
}
