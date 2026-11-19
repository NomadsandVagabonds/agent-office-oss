// The Backrooms — the lawn flamingo in the hand, as a pure rule: where the hand and the bird are, a given time into a stab.
// No three.js, nothing random: a function of the times it is given, so a test can read it and a second player's view of
// their own hand runs the same.
//
// It is held by the neck like a short spear, the stakes forward and a little down, the bird's body ahead of the fist and
// its head just behind it. A stab: drawn back a hand's breadth (`draw`), then driven forward and down (`drive`).
//   went in   it stays where it went (pursuer.js draws it there): the hand lets go at the end of the drive, opens, and
//             drops away out of the bottom of the picture (`release`), and the next thing in the pockets comes up after.
//   missed    it is held out at the end of the drive for a moment, and pulled back to where it was (`recover`).
//
// Offsets are metres in the camera's frame (x right, y up, z toward the viewer); angles are radians.

export const STAB = Object.freeze({
  draw: 0.09,            // seconds drawing back
  drive: 0.1,            // seconds driving it forward
  hold: 0.06,            // seconds held out at the end of a miss
  recover: 0.24,         // seconds coming back from a miss
  release: 0.34,         // seconds for the empty hand to let go and drop away, when it went in
  back: Object.freeze([0.012, 0.02, 0.07]),        // where it is drawn back to (from where it is held)
  out: Object.freeze([-0.05, -0.05, -0.3]),        // where the drive takes it
  pitchBack: -0.12, pitchOut: 0.16,                // the stakes tipped up drawing back, down driving (pitch: + is the stakes down)
});
/** How long a stab takes, from the click to the hand at rest again (went in: to the empty hand gone). */
export const stabLength = (went) => STAB.draw + STAB.drive + (went ? STAB.release : STAB.hold + STAB.recover);

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (v) => { const k = clamp01(v); return k * k * (3 - 2 * k); };
const fast = (v) => { const k = clamp01(v); return 1 - (1 - k) * (1 - k) * (1 - k); };       // (out of the blocks, and slowing)
const mix = (a, b, w) => a + (b - a) * w;

/**
 * The pose, `t` seconds into a stab. went: true it went in · false it missed · null not known yet (as a miss until it is).
 * → { x, y, z, pitch, roll, bird: is the bird still in the hand, open: 0…1 how far the hand has let go, gone: the empty
 * hand is out of the picture } — or null before a stab or after one is over (the hand is at rest).
 */
export function stabPose(t, went = null) {
  if (!(t >= 0)) return null;
  const S = STAB, end = stabLength(!!went);
  if (t >= end) return null;
  const at = (p, pitch) => ({ x: p[0], y: p[1], z: p[2], pitch, roll: 0, bird: true, open: 0, gone: false });
  if (t < S.draw) { const k = smooth(t / S.draw); return at(S.back.map((v) => v * k), S.pitchBack * k); }
  const t2 = t - S.draw;
  if (t2 < S.drive) {
    const k = fast(t2 / S.drive);
    return at(S.back.map((v, i) => mix(v, S.out[i], k)), mix(S.pitchBack, S.pitchOut, k));
  }
  const t3 = t2 - S.drive;
  if (went) {
    // let go: the bird stays where it went; the hand opens, sinks and drops out of the bottom of the picture
    const k = t3 / S.release, o = smooth(k / 0.35), d = smooth((k - 0.2) / 0.8);
    return { x: S.out[0] + 0.04 * d, y: S.out[1] - 0.28 * d * d, z: mix(S.out[2], 0.02, d), pitch: S.pitchOut + 0.5 * d, roll: -0.3 * d, bird: false, open: o, gone: k > 0.97 };
  }
  if (t3 < S.hold) return at(S.out.slice(), S.pitchOut);
  const k = smooth((t3 - S.hold) / S.recover);
  return at(S.out.map((v) => v * (1 - k)), S.pitchOut * (1 - k));
}
