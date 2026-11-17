import { Batch } from '../../kit.js';
import { M, Vox, VOXEL } from '../../../vox/vox.js';

const skin = M('#c9b59d', 0);
const ridge = M('#d4c2aa', 0);
const underskin = M('#ab9680', 0);
const crease = M('#8c7767', 0);
const SCALE = .84;
const HIP = 37 * VOXEL * SCALE;
const NECK = 66 * VOXEL * SCALE;
const FACING = Math.PI / 2;

function feet(asymmetry) {
  const v = new Vox();
  v.tube(-4, 4, -1, -3, 39, 0, 2.6, skin);
  v.tube(4, 4, 1, 3, 39, 0, 2.9, skin);
  v.rbox(-8, 0, -4, -1, 3, 7, 2, underskin);
  v.rbox(1, 0, -3, 10, 4, 9, 2, underskin);
  v.ellipsoid(asymmetry * 5, 3, 4, 4, 2.5, 5, skin);
  return v;
}

function trunk(asymmetry) {
  const v = new Vox();
  v.ellipsoid(0, 38, 0, 7, 5, 4, skin);
  v.rbox(-5, 37, -3, 6, 63, 4, 3, skin);
  v.ellipsoid(0, 59, 0, 10, 5, 5, skin);
  v.tube(1, 60, 0, 0, 69, 1, 3, underskin);
  v.tube(-8, 59, 0, -10, 44, 1, 2.6, skin);
  v.tube(-10, 44, 1, -11, 27, 3, 1.9, skin);
  v.tube(8, 59, -1, 10, 42, 0, 2.7, skin);
  v.tube(10, 42, 0, 10, 23, 2, 2.1, skin);
  v.rbox(-13, 21, 1, -9, 30, 6, 1, underskin);
  v.rbox(8, 18, 0, 13, 26, 5, 1, underskin);
  // Long folds draw the shoulder down into the ribs and hands.
  v.tube(7 * asymmetry, 59, 3, 4 * asymmetry, 46, 4, 1.35, ridge);
  v.tube(4 * asymmetry, 46, 4, 5 * asymmetry, 40, 3, 1.1, underskin);
  v.tube(10, 24, 4, 11, 16, 4, 1, skin);
  return v;
}

function face(asymmetry) {
  const v = new Vox();
  v.rbox(-6, 66, -4, 6, 86, 6, 4, skin);
  v.ellipsoid(asymmetry, 82, 0, 7.6, 5.8, 5.2, skin);
  v.ellipsoid(asymmetry * 4, 73, 3, 5, 7, 4, skin);
  v.tube(asymmetry * 6, 76, 4, asymmetry * 4, 68, 3, 2, underskin);
  // Recesses sit at different heights. Overlapping folds erode the face
  // without giving it eyes, teeth, or a readable expression.
  v.carve(-5, 77, 4, -1, 79, 9);
  v.carve(2, 75, 4, 6, 77, 10);
  v.box(-5, 77, 3, -1, 78, 4, crease);
  v.box(2, 75, 3, 6, 76, 4, crease);
  v.tube(-6, 79, 5, -1, 78, 6, 1.3, ridge);
  v.tube(1, 77, 6, 7, 76, 5, 1.4, ridge);
  v.tube(-5, 72, 5, 4, 70, 6, 1, crease);
  v.tube(-6, 73, 5, 5, 71, 6, 1.3, skin);
  v.tube(asymmetry * 3, 72, 6, asymmetry * 5, 66, 4, 1.3, ridge);
  return v;
}

/** Fixed bather under a running spray. Models are authored facing out of the bay. */
export function showerFigure(c, spray, variant) {
  const { x, z } = spray.head;
  const asymmetry = variant ? 1 : -1;
  const options = { rot: FACING, scale: SCALE, solid: false, shadow: false };
  c.model(`shower-figure:${variant}:feet`, () => feet(asymmetry), x, z, options);
  c.shadow(x, z, .4, .44, .42, .023);
  c.solid(x - .15, z - .18, x + .18, z + .18, { keep: true, top: 1.77 });

  const bodyBatch = new Batch(true);
  const faceBatch = new Batch(true);
  c.model(`shower-figure:${variant}:body`, () => trunk(asymmetry), x, z, { ...options, batch: bodyBatch });
  c.model(`shower-figure:${variant}:head`, () => face(asymmetry), x, z, { ...options, batch: faceBatch });
  const body = c.dynamic(bodyBatch, { pivot: [x, HIP, z], wet: .25 });
  const head = c.dynamic(faceBatch, { pivot: [x, NECK, z], wet: .28 });
  body.name = 'shower-figure';
  head.name = 'shower-figure-head';
  body.add(head);
  head.position.set(0, NECK - HIP, 0);

  const at = c.toWorld(x, z);
  const phase = variant * 2.7;
  const tilt = asymmetry * .036;
  c.tick((dt, time, visitor) => {
    const cycle = time * .67 + phase;
    body.rotation.x = Math.sin(cycle) * .034;
    body.rotation.z = -.019 + Math.cos(cycle * .61) * .018;
    head.rotation.x = tilt - body.rotation.x * .36;
    // It can tip its face a little as someone passes the opening. A short
    // range and the stall walls limit its attention to that brief glimpse.
    const dx = visitor.x - x, dz = visitor.z - z;
    const inFront = visitor.inside && dx > .35 && Math.hypot(dx, dz) < 4.4;
    const target = inFront && c.world.los(at.x, at.z, visitor.world.x, visitor.world.z)
      ? Math.max(-.28, Math.min(.28, Math.atan2(-dz, dx))) : 0;
    head.rotation.y += (target - head.rotation.y) * (1 - Math.exp(-dt * 1.45));
  });
}
