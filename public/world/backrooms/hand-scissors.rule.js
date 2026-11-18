// The Backrooms — the scissors in the hand, as a pure rule: where the fist and the blades are, a given time into a jab.
// No three.js, no DOM, no Math.random: everything is a function of the seconds since the jab and how it went, so a
// second player's view of their own hand runs the same and a test can read it.
//
// A jab is a pull-back, a stab, and one of four endings:
//   'hit'      the point goes in and stops dead; the fist judders, the blades bite shut, the wrist wrenches, it comes back
//   'miss'     the arm goes further than it meant to, the blades shut on air, and it comes back late and low
//   'snapped'  a hit, and then the pin gives: one blade falls away out of the picture, the other swings loose, the hand goes down
//   null       nobody has said how it went (the hit is resolved elsewhere): a plain stab that shuts at the end
//
// Offsets are metres in the camera's frame (x right, y up, z toward the viewer). Angles are radians on the held model.
// open: 1 the blades at their resting V, 0 shut, above 1 splayed past it (only once broken).

export const JAB = Object.freeze({
  windup: 0.07,         // seconds pulling back before the stab
  thrust: 0.08,         // seconds from pulled back to full stretch
  hit: 0.40,            // whole jab, by ending
  miss: 0.50,
  snapped: 0.95,
  plain: 0.40,
  reach: 0.19,          // metres forward at full stretch (a miss goes further)
  overreach: 1.3,
  breakAt: 0.24,        // seconds in when the pin goes, on a snapped jab
  idleOpen: 0.12,       // how far open the blades sit in the fist, between jabs
});

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (v) => { const k = clamp01(v); return k * k * (3 - 2 * k); };
const easeOut = (v) => { const k = clamp01(v); return 1 - (1 - k) * (1 - k) * (1 - k); };

/** How long a jab that ended this way lasts. */
export function jabLength(outcome) {
  return JAB[outcome] ?? JAB.plain;
}

/** The scissors at rest in the fist: no offset, the blades a crack open. */
export function restPose() {
  return { x: 0, y: 0, z: 0, pitch: 0, yaw: 0, roll: 0, open: JAB.idleOpen, broke: -1 };
}

/**
 * The pose `t` seconds into a jab that ended `outcome` → { x, y, z, pitch, yaw, roll, open, broke } or null once over.
 * broke: seconds since the pin went (snapped only), else -1.
 */
export function jabPose(t, outcome = null) {
  const end = jabLength(outcome);
  if (!(t >= 0) || t >= end) return null;
  const { windup, thrust } = JAB, peakAt = windup + thrust, miss = outcome === 'miss';
  const p = restPose();

  // the pull-back: the fist comes back and the wrist cocks, the blades come open ready
  const back = smooth(t / windup) * (1 - smooth((t - windup) / (thrust * 0.6)));
  // the stab: out fast, all of it in the last of the time
  const out = easeOut((t - windup) / (thrust * (miss ? 1.25 : 1)));
  // and home again: when, and how slowly, is the ending's
  const homeFrom = miss ? peakAt + 0.12 : outcome === 'snapped' ? JAB.breakAt + 0.1 : peakAt + 0.07;
  const home = smooth((t - homeFrom) / (end - homeFrom));
  const stretch = out * (1 - home) * (miss ? JAB.overreach : 1);

  p.z = 0.035 * back - JAB.reach * stretch;
  p.x = 0.012 * back - 0.085 * stretch;
  p.y = -0.012 * back + 0.04 * stretch;
  p.pitch = 0.32 * back - 0.42 * stretch;            // the wrist cocks back, then the point drops onto the line
  p.yaw = 0.30 * stretch;                            // the point swings in toward the middle of the picture
  p.roll = 0.45 * stretch;                           // and the fist turns over as it goes in

  // the blades: open on the pull-back, bitten shut at the end of the stab
  const shut = smooth((t - (peakAt - thrust * 0.35)) / (thrust * 0.45));
  p.open = JAB.idleOpen + (1 - JAB.idleOpen) * back * (1 - shut);
  if (t > peakAt) p.open = JAB.idleOpen * smooth((t - peakAt - 0.1) / 0.2);

  if (outcome === 'hit' || outcome === 'snapped') {
    // it went into something: no further, a judder that dies away, and a wrench of the wrist
    const since = t - peakAt;
    if (since > 0) {
      const die = Math.exp(-since * 22);
      p.x += Math.sin(since * 170) * 0.0055 * die;
      p.y += Math.sin(since * 133 + 1.3) * 0.004 * die;
      p.roll += 0.28 * smooth(since / 0.06) * (1 - home);
      p.pitch += 0.06 * smooth(since / 0.05) * (1 - home);
    }
  } else if (miss) {
    // nothing there: the arm sags at the end of its reach and the blades fall open loose
    const since = t - peakAt;
    if (since > 0) {
      p.y -= 0.03 * smooth(since / 0.14) * (1 - home);
      p.pitch -= 0.12 * smooth(since / 0.14) * (1 - home);
      p.open = 0.38 * smooth((since - 0.05) / 0.1) * (1 - home) + JAB.idleOpen * home;
    }
  }

  if (outcome === 'snapped' && t >= JAB.breakAt) {
    // the pin goes: the blade left in the hand swings loose past its stop, and the hand drops away out of the picture
    const since = t - JAB.breakAt;
    p.broke = since;
    p.open = 1 + 0.9 * easeOut(since / 0.18) + Math.sin(since * 26) * 0.12 * Math.exp(-since * 6);
    const drop = smooth((since - 0.2) / (end - JAB.breakAt - 0.2));
    p.y -= 0.34 * drop;
    p.x += 0.06 * drop;
    p.pitch += 0.5 * drop;
  }
  return p;
}

/**
 * Where the blade that fell is, `since` seconds after the pin went, relative to where it was: it drops under gravity,
 * tumbling, out of the bottom of the picture. → { x, y, z, spin }
 */
export function fallenBlade(since) {
  const k = Math.max(0, since);
  return { x: 0.05 * k, y: -0.5 * 4.2 * k * k + 0.06 * k, z: 0.02 * k, spin: 9 * k };
}
