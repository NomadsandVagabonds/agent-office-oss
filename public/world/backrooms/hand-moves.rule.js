// The Backrooms — two moves of the visitor's own hand that are not a shove (the owner, of the sticky notes: "the push action
// when they are on the screen should have an animation of the player's hand wiping or knocking it off … and for the knock
// out of the air as well"). Where one hand is, a given time into the move, in camera space (−z forward, as
// shove-hands.rule.js). Pure: no three.js, nothing random. hand.js puts the shove's own hand there.
//
//   wipe   the right hand comes up close in front of the lens, palm to it, and wipes across from right to left and away
//   swat   a quick backhand at something in the air to one side: the hand on that side cocks in, flicks out, and drops

export const MOVES = Object.freeze({
  wipe: 0.42,           // seconds
  swat: 0.26,
});

const smooth = (u) => { const k = Math.max(0, Math.min(1, u)); return k * k * (3 - 2 * k); };

/** Between keyframes [t, x, y, z, yaw, pitch, roll], eased. → { x, y, z, yaw, pitch, roll } */
function along(keys, t) {
  let i = 0;
  while (i < keys.length - 2 && t > keys[i + 1][0]) i++;
  const a = keys[i], b = keys[i + 1], u = smooth((t - a[0]) / Math.max(1e-6, b[0] - a[0]));
  const at = (n) => a[n] + (b[n] - a[n]) * u;
  return { x: at(1), y: at(2), z: at(3), yaw: at(4), pitch: at(5), roll: at(6) };
}

// the right hand, palm to the lens (yaw π: the shove shows its back), fingers leaning the way it goes
const WIPE = [
  [0.00, 0.24, -0.40, -0.30, Math.PI, 0.10, 0.25],
  [0.11, 0.15, -0.07, -0.23, Math.PI, 0.00, 0.10],
  [0.30, -0.18, 0.03, -0.23, Math.PI, -0.05, -0.45],
  [0.42, -0.34, -0.32, -0.32, Math.PI, 0.15, -0.70],
];

/** The wipe, `t` seconds in → { side: 1, x, y, z, yaw, pitch, roll } or null once over. */
export function wipePose(t) {
  if (!(t >= 0) || t >= MOVES.wipe) return null;
  return { side: 1, ...along(WIPE, t) };
}

/** Which side a swat goes to: −1 left, +1 right, from a number or anything with an x (camera-relative). */
export const swatSide = (dir) => (Math.sign(typeof dir === 'number' ? dir : dir?.x ?? 1) || 1);

/** The swat to `dir`'s side, `t` seconds in → { side, x, y, z, yaw, pitch, roll } or null once over. */
export function swatPose(t, dir = 1) {
  if (!(t >= 0) || t >= MOVES.swat) return null;
  const s = swatSide(dir);
  const keys = [
    [0.00, s * 0.13, -0.38, -0.34, 0, 0.15, 0],
    [0.08, s * 0.08, -0.07, -0.42, s * 0.85, 0.05, -s * 0.2],     // cocked in across the body
    [0.16, s * 0.42, 0.03, -0.52, -s * 0.55, -0.05, s * 0.55],    // flung out: the knock
    [0.26, s * 0.30, -0.38, -0.36, -s * 0.2, 0.15, s * 0.2],      // and down out of the picture
  ];
  return { side: s, ...along(keys, t) };
}
