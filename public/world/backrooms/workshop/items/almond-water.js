// The Backrooms — Object 1: Almond Water ("Complimentary Almond Beverage").
// Sculpted in 2.5 cm voxels: cream-and-slate carton with screw cap and red almond drop emblem.
import * as THREE from 'three';
import { Vox, M, tone } from '../../../vox/vox.js';
import { Batch } from '../../kit.js';
import { getWorkshop } from '../state.js';

/** Upright Almond Water carton, origin at base centre. ~6 × 12 × 6 voxels. */
export function almondCartonVox() {
  const v = new Vox();
  const cream = M('#f0e9d6', 1), shade = tone(cream, -0.12), blue = M('#386988', 0);
  const red = M('#b8443a', 0), cap = M('#faf8f0', 0), foil = M('#9aa3ad', 0);

  v.rbox(-3, 0, -3, 3, 9, 3, 1, cream, 'xz');
  // Gable-top shoulders tapering up to a screw cap
  v.box(-3, 9, -2, 3, 10, 2, shade);
  v.box(-2, 10, -2, 2, 11, 2, cream);
  v.box(-3, 10, 0, 3, 11, 1, foil);
  v.cyl('y', 0.5, 0.5, 11, 12, 1.3, cap);

  // Slate-blue label band all round + tiny red almond emblem on front (+z) and back (-z)
  v.box(-3, 3, -3, 3, 7, 3, blue);
  for (const z of [-3, 2]) {
    v.box(-2, 4, z, 2, 6, z + 1, cream);
    v.set(0, 5, z, red);
    v.set(-1, 4, z, red);
  }
  return v;
}

/** Tipped-over empty carton, origin on the floor. */
export function almondEmptyVox() {
  const v = new Vox();
  const cream = M('#ded6c0', 1), blue = M('#325b75', 0), dark = M('#1e1c18', 0);
  v.rbox(-5, 0, -3, 4, 5, 3, 1, cream, 'yz');
  v.box(-2, 0, -3, 2, 5, 3, blue);
  v.box(4, 1, -1, 5, 3, 1, dark);
  return v;
}

/**
 * Place an interactive Almond Water carton at (x, y, z) in room coordinates.
 * Picking it up (`E`) hides the mesh and stores it in per-visit workshop state.
 */
export function placeAlmondWater(c, x, y, z, opt = {}) {
  const ws = getWorkshop(c.env);
  const scale = (opt.scale ?? 0.82) * c.kit.VOXEL;
  const rot = opt.rot ?? 0;
  const b = new Batch(true);
  const m = new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rot),
    new THREE.Vector3(scale, scale, scale),
  );
  b.addVox(c.kit.model('workshop:almond', almondCartonVox).solid, m);
  const node = c.dynamic(b, { pivot: [x, y, z] });

  let taken = false;
  const ux = opt.useX ?? x, uz = opt.useZ ?? z;
  const use = c.use({
    x: ux,
    z: uz,
    r: opt.r ?? 1.45,
    cone: opt.cone ?? 0.45,
    label: 'take almond water',
    when: () => !taken && !ws.almond && (opt.when ? opt.when() : true),
    use: () => {
      if (ws.takeAlmond(c, x, z)) {
        taken = true;
        node.visible = false;
        opt.onTake?.();
      }
    },
  });

  return {
    node,
    use,
    get taken() { return taken; },
  };
}
