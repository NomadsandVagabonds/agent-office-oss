// The Backrooms — the Lane Keeper's body and how it moves (rooms/channel-hall.js has its rule: where it is and what it is
// doing). The model is the room's (channel-hall/assets.js keeperRig): a capped, blank-faced head low in the water, two long
// hands, and a lane line of eight floats strung out behind it along the way it came. This adds its flinch and its going.
//
//   makeLaneKeeper(c, p) → { head, parts, hands, update(s, time, hurt), die(progress, time) }
//   update   as keeperRig's, and hurt (seconds since a jab, Infinity: none) for its flinch: the head jerks back and up out of
//            the water and its hands fly open, and a shiver runs back down the line of floats, nearest first
//   die      0 → 1, from wherever it last was: the head jerks back, then tips over and goes down under the water, the hands
//            sinking after it; the line goes slack, the floats losing their bob and drifting a little apart, and they come to
//            rest on the surface where they were. What is left is the floats on the water: nothing that keeps the lane.
// Nothing random: the floats' own index and the clock.
import { keeperRig } from './assets.js';

const ease = (v) => { const u = Math.max(0, Math.min(1, v)); return u * u * (3 - 2 * u); };

export function makeLaneKeeper(c, p) {
  const rig = keeperRig(c, p), { head, parts, hands } = rig;
  let from = null;                                 // (where everything was when its going began)

  function update(s, time, hurt = Infinity) {
    from = null;
    for (const g of [head, ...parts, ...hands]) g.visible = true;
    rig.update(s, time);
    if (!(hurt < 0.6)) return;
    const e = Math.exp(-hurt * 6) * Math.min(1, hurt * 30) * (1 - hurt / 0.6);
    head.position.y += 0.16 * e; head.rotation.x -= 0.5 * e;
    hands.forEach((g, i) => { g.position.y += 0.08 * e; g.rotation.z += (i ? 1 : -1) * 0.7 * e; });
    parts.forEach((g, i) => { const w = Math.max(0, e - i * 0.07); g.position.y += Math.sin(hurt * 40 - i * 0.9) * 0.05 * w; g.rotation.z += Math.sin(hurt * 32 - i) * 0.25 * w; });
  }

  function die(progress, time = 0) {
    const k = Math.max(0, Math.min(1, progress));
    if (from === null) from = {
      head: { y: head.position.y, rx: head.rotation.x },
      parts: parts.map((g) => ({ x: g.position.x, y: g.position.y, z: g.position.z, ry: g.rotation.y })),
      hands: hands.map((g) => g.position.y),
    };
    const jerk = ease(k / 0.12) * (1 - ease((k - 0.12) / 0.15)), down = ease((k - 0.2) / 0.55), slack = ease(k / 0.6);
    head.position.y = from.head.y + 0.14 * jerk - 0.55 * down;
    head.rotation.x = from.head.rx - 0.6 * jerk + 1.3 * down;
    head.visible = down < 0.98;
    hands.forEach((g, i) => { g.position.y = from.hands[i] + 0.05 * jerk - 0.5 * ease((k - 0.3) / 0.55); g.rotation.z = (i ? 1 : -1) * (0.6 * jerk + 0.3 * down); g.visible = k < 0.9; });
    // the line goes slack: each float drifts a little off the line, to its own side, its bob dying away, and settles flat
    parts.forEach((g, i) => {
      const f = from.parts[i], side = i % 2 ? 1 : -1, off = 0.12 * slack * (1 + (i % 3) * 0.4), bob = Math.sin(time * 2 - i * 0.8) * 0.035 * (1 - slack);
      g.position.set(f.x + Math.cos(f.ry) * side * off, f.y + bob, f.z - Math.sin(f.ry) * side * off);
      g.rotation.set(Math.sin(time * 2 - i) * 0.08 * (1 - slack), f.ry + side * 0.35 * slack, Math.sin(time - i) * 0.09 * (1 - slack));
    });
  }

  return { head, parts, hands, update, die };
}
