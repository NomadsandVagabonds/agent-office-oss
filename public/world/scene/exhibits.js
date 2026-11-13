// The Office — what is on show. The gallery in the plaza puts the newest
// things agents have made on pedestals; each team's sideboard holds whatever
// that team chose to display (`office place <creation>`).
import * as THREE from 'three';
import { VOXEL } from '../vox/vox.js';
import { PEDESTAL_TOP, CREDENZA_SLOTS } from '../props/office.js';
import { buildExhibit } from './deskitems.js';

export function createExhibits(office) {
  const turning = [];
  let placed = [];

  function clear() {
    for (const o of placed) o.parent?.remove(o);
    placed = []; turning.length = 0;
  }

  function put(parent, spec, x, y, z, turn) {
    let item;
    try { item = buildExhibit(spec, office.creations); } catch (err) { console.warn('[office] exhibit', spec.id, err); return; }
    const holder = new THREE.Group();
    holder.position.set(x, y, z);
    holder.add(item);
    parent.add(holder);
    placed.push(holder);
    if (turn) turning.push(holder);
  }

  /** Lay everything out again from the latest world snapshot. */
  function sync() {
    const world = office.net.state.world, w = office.world;
    if (!world || !w) return;
    clear();
    const ids = world.gallery?.pedestals || [];
    for (const o of w.layout.objects) {
      if (o.type === 'pedestal') {
        const spec = office.creations[ids[o.index]];
        const node = w.furniture.nodes.get(o.id);
        if (spec && node) put(node, spec, 0, PEDESTAL_TOP * VOXEL, 0, true);
      } else if (o.type === 'credenza' && o.deptId) {
        const shelf = world.shelves?.[o.deptId] || [];
        const node = w.furniture.nodes.get(o.id);
        if (!node) continue;
        shelf.forEach((id, i) => {
          const spec = id && office.creations[id];
          const at = CREDENZA_SLOTS[i];
          if (spec && at) put(node, spec, at[0] * VOXEL, at[1] * VOXEL, at[2] * VOXEL, false);
        });
      }
    }
  }

  return {
    sync,
    /** Which creation stands on a pedestal (for the label you get when you click it). */
    onPedestal(index) { return office.creations[(office.net.state.world?.gallery?.pedestals || [])[index]] || null; },
    update(dt) { for (const h of turning) h.rotation.y += dt * 0.5; },
  };
}
