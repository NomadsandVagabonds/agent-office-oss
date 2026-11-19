// The Backrooms — the fire extinguisher in the hand, as a pure rule: where the fist and the canister are, how far the
// lever is squeezed, and where the gauge's needle stands, a given time into a burst. No three.js, no DOM, no Math.random:
// all of it is a function of the times it is given, so a test can read it and a second player's view of their own hand
// runs the same.
//
// Let go, it hangs from the fist by its handle, the horn forward, the gauge turned up where you can read it.
// Squeezed, it comes up and in toward the middle of the picture to aim (`aim` seconds), the lever goes down to the
// handle, and while it sprays it kicks back a little and shudders, as a canister under pressure does. Let go again, it
// settles back (`settle`). Run dry, the lever is pumped twice more on nothing (`sputter`), and it sags.
//
// Offsets are metres in the camera's frame (x right, y up, z toward the viewer); angles are radians.

export const HOLD = Object.freeze({
  aim: 0.12,                   // seconds to come up and aim
  settle: 0.24,                // seconds to settle back, let go
  squeezeIn: 0.05,             // seconds for the lever to go down
  raise: Object.freeze([-0.03, 0.035, -0.025]),    // where it comes to, aiming (from where it hangs)
  pitch: 0.04, yaw: 0.07,      // …and how it turns: the horn up a hair and in toward the middle
  kick: 0.009,                 // metres it is pushed back while it sprays
  shudder: 0.0022, hz: 43,     // and how it shakes
  sputter: 0.6,                // seconds of pumping a dry one
  sag: Object.freeze([0.012, -0.03, 0.01]),        // where a dry one ends up, sagging
  lever: Object.freeze([-12, 1]),                  // degrees the lever stands: let go, squeezed down to the handle
  needle: Object.freeze([-1.05, 1.05]),            // radians across the dial: empty (red, left) to full (green, right)
});

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (v) => { const k = clamp01(v); return k * k * (3 - 2 * k); };

/**
 * The pose.
 * @param s { on: spraying now · since: seconds since this burst began (on) · off: seconds since it was let go (Infinity: never
 *            squeezed) · dry: seconds since it ran out (Infinity: it has not) · share: 0…1 of a full charge left · time: a clock }
 * @returns { x, y, z, pitch, yaw, roll, squeeze 0…1, needle radians }
 */
export function holdPose({ on = false, since = 0, off = Infinity, dry = Infinity, share = 1, time = 0 } = {}) {
  const H = HOLD;
  // how far up to aim: coming up while on, going down once let go (a burst is always long enough to have come right up)
  const up = on ? smooth(since / H.aim) : 1 - smooth(off / H.settle);
  let squeeze = on ? smooth(since / H.squeezeIn) : 1 - smooth(off / (H.settle * 0.5));
  const spraying = on ? smooth(since / 0.06) : 0;
  const p = {
    x: H.raise[0] * up, y: H.raise[1] * up, z: H.raise[2] * up + H.kick * spraying,
    pitch: H.pitch * up, yaw: H.yaw * up, roll: 0,
    squeeze, needle: H.needle[0] + (H.needle[1] - H.needle[0]) * clamp01(share),
  };
  if (spraying > 0) {
    const a = H.shudder * spraying;
    p.x += Math.sin(time * H.hz * 2 * Math.PI * 0.5) * a; p.y += Math.sin(time * H.hz * 2 * Math.PI * 0.37 + 1.3) * a; p.roll += Math.sin(time * 29) * 0.01 * spraying;
    p.needle += Math.sin(time * 31) * 0.04 * spraying;                                     // (the needle trembles with it)
  }
  if (dry < H.sputter) {
    // pumped twice on nothing, then it sags in the hand
    const k = dry / H.sputter, pump = Math.abs(Math.sin(k * Math.PI * 2));
    squeeze = Math.max(squeeze, pump); p.squeeze = squeeze;
    const sag = smooth(k);
    p.x += H.sag[0] * sag; p.y += H.sag[1] * sag; p.z += H.sag[2] * sag; p.pitch -= 0.12 * sag;
  } else if (Number.isFinite(dry)) { p.x += H.sag[0]; p.y += H.sag[1]; p.z += H.sag[2]; p.pitch -= 0.12; }
  return p;
}

/** The lever, in degrees, at this much squeeze. */
export const leverAt = (squeeze) => HOLD.lever[0] + (HOLD.lever[1] - HOLD.lever[0]) * clamp01(squeeze);
