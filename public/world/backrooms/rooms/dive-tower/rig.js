// The Backrooms — the Towel Return's figures (rooms/dive-tower/chase.js): the cubicle grid's smiling climbers in swim
// trunks (cubicle-grid/rig.js buildSmilingClimber), and how one of them goes when it is jabbed. One jab takes one (basic:
// cast/health.rule.js), so there is no flinch to draw: only its going.
//
//   makeTowelReturn(kit, idx) → the climber's rig ({ group, bodyGroup, head, armL, armR, pose, light }) and die(progress, time)
//   die    0 → 1: the jab jerks it upright, head thrown back and its arms flung up; then its legs go and it falls flat on
//          its face where it stood, arms out past its head, and the head rolls to one side so the grin is still to be
//          seen; a last twitch, and it lies there. The room places the group; this moves only what is inside it.
//          Nothing random: its own index and the clock.
import { buildSmilingClimber } from '../cubicle-grid/rig.js';

const ease = (v) => { const u = Math.max(0, Math.min(1, v)); return u * u * (3 - 2 * u); };
const mix = (a, b, w) => a + (b - a) * w;

export function makeTowelReturn(kit, idx = 0) {
  const rig = buildSmilingClimber(kit, idx, { swimTrunks: true });
  const { bodyGroup, head, armL, armR } = rig, side = idx % 2 === 0 ? 1 : -1;

  function die(progress, time = 0) {
    const k = Math.max(0, Math.min(1, progress));
    const jerk = ease(k / 0.12) * (1 - ease((k - 0.12) / 0.1));             // (the jab: up and back, for a moment)
    const fall = Math.pow(Math.max(0, Math.min(1, (k - 0.18) / 0.34)), 2);   // (and over it goes, faster as it goes)
    const land = k > 0.52 ? Math.sin((k - 0.52) * 38) * Math.exp(-(k - 0.52) * 14) : 0;
    const twitch = k > 0.7 && k < 0.82 ? Math.sin(time * 47 + idx) * 0.06 : 0;
    // flat on its face, from its feet; lifted by its own thickness, so its front lies on the boards and not through them
    bodyGroup.rotation.set(-0.3 * jerk + 1.52 * fall + 0.04 * land, 0, 0.12 * side * fall);
    bodyGroup.position.set(0, 0.05 * jerk + 0.09 * fall + 0.02 * Math.abs(land), 0);
    head.rotation.set(-0.7 * jerk + 0.1 * fall, side * 1.15 * fall, side * (0.28 + 0.2 * fall) + twitch);
    armL.rotation.set(mix(-2.4 * jerk - 0.8 * (1 - jerk), -2.85, fall), 0.15 * (1 - fall), mix(-0.6, -0.35, fall) + twitch);
    armR.rotation.set(mix(-2.4 * jerk - 0.8 * (1 - jerk), -2.7, fall), -0.15 * (1 - fall), mix(0.6, 0.45, fall) - twitch);
  }

  return { ...rig, die };
}
