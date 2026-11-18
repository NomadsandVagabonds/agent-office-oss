// The Backrooms — the Toadstool Lagoon's inverted bathers (rooms/kiddie-lagoon.js): an inner tube with a pair of office
// legs sticking up out of it, the rest of them under the water. The model is the waterpark's own (waterpark.js
// makeInnerTube); this is how one moves: its kicking, a flinch when it is jabbed, and its going.
//
// The room places and bobs `group` as it always has (its position and its sway, rotation.z); everything here moves only
// what is inside it, so the room's lines stay as they are. Nothing random: the clock and what the room says.
//
//   pose(time, phase, agitation, hurt)  its kicking (agitation 0…1, the room's); hurt: seconds since a jab, for a flinch
//   die(progress, time)                 its going, 0 → 1 (cast/health.rule.js): the legs give a last kick, go limp and
//                                       fold over, and it goes down under the water, the float rolling over after it.
//                                       What is left is an empty tube, as the five empty ones are: nothing in the way.
import * as THREE from 'three';
import { makeInnerTube } from '../../waterpark.js';

export function makeBather(kit, color, scale = 0.031) {
  const tube = makeInnerTube(kit, color, true, scale);
  const legs = tube.children.filter((o) => o.name === 'bather-left-leg' || o.name === 'bather-right-leg');
  const group = new THREE.Group();
  group.name = 'inverted-bather';
  group.add(tube);
  const ease = (v) => { const k = Math.max(0, Math.min(1, v)); return k * k * (3 - 2 * k); };

  function pose(time, phase = 0, agitation = 0, hurt = Infinity) {
    tube.userData.kick?.(time, phase, agitation);
    tube.position.set(0, 0, 0); tube.rotation.set(0, 0, 0);
    for (const leg of legs) leg.visible = true;
    // a jab: both legs fly apart and kick, and the float jerks under them
    if (hurt < 0.6) {
      const e = Math.exp(-hurt * 6) * Math.min(1, hurt * 30) * (1 - hurt / 0.6);
      legs.forEach((leg, i) => {
        const side = i ? 1 : -1;
        leg.rotation.x += Math.sin(hurt * 38 + i * 2) * 0.5 * e;
        leg.rotation.z += side * 0.55 * e;
      });
      tube.position.y = -0.05 * e; tube.rotation.z = Math.sin(hurt * 30) * 0.12 * e;
    }
  }

  function die(progress, time = 0) {
    const k = Math.max(0, Math.min(1, progress));
    tube.userData.kick?.(time, 0, 0);
    // a last kick, then limp: they fold over to one side, together, and go down
    const kick = k < 0.2 ? Math.sin(k * 90) * (1 - k / 0.2) : 0, limp = ease((k - 0.15) / 0.4), under = ease((k - 0.45) / 0.45);
    legs.forEach((leg, i) => {
      const side = i ? 1 : -1;
      leg.rotation.x = kick * 0.6 + 1.25 * limp;
      leg.rotation.z = side * 0.04 + 0.3 * limp;
      leg.rotation.y = 0;
      leg.position.y = 2 * scale - 0.55 * under;
      leg.visible = under < 0.98;
    });
    // the float rolls a little as what was in it goes down, and settles
    tube.rotation.z = 0.35 * limp * (1 - under) + Math.sin(k * 14) * 0.05 * (1 - k);
    tube.position.y = -0.06 * limp * (1 - under);
  }

  pose(0);
  return { group, tube, legs, light: (rgb) => tube.userData.light?.(rgb), pose, die };
}
