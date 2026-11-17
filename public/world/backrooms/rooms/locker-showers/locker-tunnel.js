import { lin } from '../../kit.js';
import { foldScreens } from './fold-screen.js';

// The same service corridor repeats behind the locker at progressively
// smaller scales. These sections own both the silhouette and the clearance.
export function lockerTunnel(c, plan, { pink, ceiling, wall, box }) {
  const trim = lin('#8c9d96');
  const casing = lin('#263937');
  const tile = lin('#a4bbb6');
  const lamp = c.shining('showers:service-fixtures', c.kit.tex.panel(true), 1.65, lin('#abf4dc'));
  const deadLamp = lin('#35423d');
  for (const cell of plan.cells) {
    const { x, z0, z1, half, head, min, max } = cell;
    const left = x - half, right = x + half;
    wall(min, z0, left, z1, 0, 2.65, tile);
    wall(right, z0, max, z1, 0, 2.65, tile);
    box(ceiling, [left, head, z0, right, 2.65, z1], lin('#9bacab'));
    // The repeating steel legs are flush with the clear opening.
    for (const z of [z0 + .05, z1 - .05]) {
      box(c.flat, [left - .035, 0, z - .035, left, head, z + .035], trim);
      box(c.flat, [right, 0, z - .035, right + .035, head, z + .035], trim);
      box(c.flat, [left - .035, head, z - .035, right + .035, head + .045, z + .035], trim);
    }
    // The tube fittings shrink with the hall. Only a few still work, leaving
    // isolated spills that let the player see the next gap before stooping.
    const z = (z0 + z1) / 2;
    const halfSpan = Math.min(.34, half * .55);
    box(c.flat, [x - halfSpan - .03, head - .013, z - .115, x + halfSpan + .03, head + .04, z + .115], casing);
    const atSeam = head === plan.folds[0].head;
    const lit = head === 2.32 || head === 1.62 || atSeam || x < 0;
    if (lit) {
      c.lay(lamp, x, z, halfSpan * 2, .14, 0, null, undefined, head - .016, true);
      c.light(x, head - .10, z, '#8fcbb9', atSeam ? 1.05 : .8,
        { far: atSeam ? 2.7 : 3.2, k: 2.5, axis: [0, -1, 0], floor: .24 });
    } else {
      box(c.flat, [x - halfSpan, head - .022, z - .07, x + halfSpan, head, z + .07], deadLamp);
    }
    // Pale tile coving at the floor makes the gap legible in near darkness.
    for (const edge of [left, right - .009]) {
      box(pink, [edge, .002, z0, edge + .009, .045, z1], lin('#718681'));
    }
  }
  foldScreens(c, plan.folds);
}
