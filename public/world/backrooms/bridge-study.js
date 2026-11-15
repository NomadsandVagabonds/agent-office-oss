// Review-only fixture. It is not dealt into a visit and does not replace the
// suburb team's Culvert. The side paths keep arbitrary generated doors usable.
import { Batch, ticks } from './kit.js';
import { lawn } from './suburb.js';
import { movableCutout } from './movable-cutout.js';

export function prepareBridgeStudy(level, builders) {
  const start = level.rooms[level.start.room]; start.H = Math.max(3.6, start.H);
  builders.start = c => {
    c.shell({ floor: false }); lawn(c, { wrong: 0, neighbour: 0 });
    const half = Math.min(2.4, c.W / 2 - .9), z0 = -1, z1 = 1, deep = 2.5;
    const floor = (a, b, d, e, y = 0) => c.floor.grid([a, y, d], [0, 0, 1], [1, 0, 0], ticks(e - d), ticks(b - a));
    floor(-c.W / 2, c.W / 2, -c.D / 2, z0); floor(-c.W / 2, c.W / 2, z1, c.D / 2);
    floor(-c.W / 2, -half, z0, z1); floor(half, c.W / 2, z0, z1);
    c.flat.box(-half, -deep - .1, z0, half, -deep, z1, [.11, .13, .12]);
    for (const z of [z0, z1]) c.flat.box(-half, -deep, z - .03, half, 0, z + .03, [.34, .35, .32]);
    for (const x of [-half, half]) c.flat.box(x - .03, -deep, z0, x + .03, 0, z1, [.34, .35, .32]);
    c.rt.floorY = (x, z) => Math.abs(x) < half && z > z0 && z < z1 ? -deep : 0;
    c.rt.headY = (x, z) => c.H - c.rt.floorY(x, z);
    const main = movableCutout(c, { x: -.5, z: 2, height: 3, facing: 2 });
    const short = movableCutout(c, { x: 1.4, z: 1.6, width: .8, height: 1.3, facing: 2, front: 'streetA', label: 'Short scenery panel' });
    if (main) c.bridgeRoute(main, { stand: { x: -.5, z: 2.8 }, path: [{ x: -.5, z: 1.5 }] });
    c.rt.bridgeStudy = { main, short, pit: { half, z0, z1 }, bank: { x: -.5, z: 1.5 }, stand: { x: -.5, z: 2.8 } };
    // A room-authored box, unrelated to the catalogue, uses that same registry.
    const x = -c.W / 2 + .65, z = Math.min(2, c.D / 2 - 1);
    const b = new Batch(); b.box(x - .25, 0, z - .25, x + .25, .6, z + .25, [.45, .32, .18]);
    c.movable(c.dynamic(b, { pivot: [x, 0, z] }), { label: 'Wooden box', foot: { x, z, x0: x - .25, x1: x + .25, z0: z - .25, z1: z + .25, bottom: 0, top: .6 } });
  };
  const a = start.rot * Math.PI / 2;
  level.start.x = start.cx - .5 * Math.cos(a) + 2.8 * Math.sin(a);
  level.start.z = start.cz + .5 * Math.sin(a) + 2.8 * Math.cos(a);
  level.start.yaw = a;
}
