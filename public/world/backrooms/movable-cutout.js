// Suburbia's painted street fronts, backed with timber rather than loose card.
// The art is the suburb builder's existing atlas; the reusable motion belongs
// to the shared movable registry. Braced scenery remains a different assembly.
import { Batch } from './kit.js';
import { setArt, upright, beam, TIMBER } from './suburb.js';
import { BRIDGE, cutoutBounds } from './bridge-rules.js';

export function movableCutout(c, { x, z, y = 0, width = 1.3, height = 2.7, facing = 2, front = 'streetB', label = 'Scenery panel' }) {
  const spec = { x, z, y, width, height, facing, thickness: BRIDGE.thickness };
  const art = setArt(c.kit), paint = new Batch(), frame = new Batch();
  const a = facing * Math.PI / 2, ux = Math.cos(a), uz = -Math.sin(a), nx = Math.sin(a), nz = Math.cos(a), half = width / 2;
  const p = (u, v, d) => [x + ux * u + nx * d, y + .04 + v, z + uz * u + nz * d];
  const face = (d, reverse, name) => {
    const l = p(reverse ? half : -half, 0, d), r = p(reverse ? -half : half, 0, d);
    upright(paint, l[0], l[2], r[0], r[2], y + .04, y + height + .04, art.uv(name));
  };
  face(.038, false, front); face(-.015, true, 'ply');
  // Rails run along the span. Their exposed backs make the load-bearing
  // structure visible, including once the painted side is face-down.
  for (const u of [-half + .07, half - .07]) beam(frame, p(u, .03, -.015), p(u, height - .03, -.015), .05, TIMBER);
  for (const v of [.07, height * .52, height - .07]) beam(frame, p(-half + .07, v, -.015), p(half - .07, v, -.015), .05, TIMBER);
  const pivot = [x, y + .04, z], group = c.dynamic(paint, { pivot, map: art.texture });
  const rails = c.dynamic(frame, { pivot });
  group.add(rails); rails.position.set(0, 0, 0);
  const foot = { ...cutoutBounds(spec), bottom: y };
  const item = c.movable(group, { foot, type: 'cutout', label, cutout: spec });
  if (item) rails.userData.movable = item;
  return item;
}
