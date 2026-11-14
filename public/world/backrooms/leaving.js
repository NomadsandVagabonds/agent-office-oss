// The Backrooms — leaving. What the camcorder sees between the wall giving and
// the tape running out. Pure: time in, a camera out.
//
// You go through the wall you were leaning on, and there is nothing on the
// other side of it to stand on or to stop you. So you keep going, out and up,
// faster — and turn round, because anybody would, and for the one time in the
// visit see the floor you were lost on from outside: all of it, lit, getting
// smaller. Then whatever is out here is brighter than the camcorder can do
// anything about.
const smooth = (v) => { const t = Math.max(0, Math.min(1, v)); return t * t * (3 - 2 * t); };
const TAU = Math.PI * 2;
const wrap = (a) => { let d = a % TAU; if (d > Math.PI) d -= TAU; if (d <= -Math.PI) d += TAU; return d; };

/** Seconds from the wall giving: through it by · turning round between · whiting out between · over at. */
export const LEAVE = Object.freeze({ through: 0.45, turn: Object.freeze([0.55, 1.75]), white: Object.freeze([2.7, 4.3]), over: 4.4 });

/**
 * @param {number} t     seconds since the wall gave
 * @param {{x:number, y:number, z:number, yaw:number, pitch:number, nx:number, nz:number, cx?:number, cz?:number}} from
 *        where the camera was and how it was turned · the way out through the wall (a unit vector, on the flat) ·
 *        the middle of the floor being left, to look back at (without it, or if it is not behind you: a spot a few metres inside the wall)
 * @returns {{x, y, z, yaw, pitch, roll, out, white, snow, track, outside, over}}
 *        out: metres from where you stood · white, snow, track: 0…1 for the picture · outside: you are through the wall
 */
export function leaving(t, from) {
  const s = Math.max(0, t - LEAVE.through);
  // through the wall at a lean; then nothing holds you, and it shows — more up than out, so that what you look back on is laid out under you
  const out = t < LEAVE.through ? 0.75 * smooth(t / LEAVE.through) : 0.75 + 1.6 * s + 3.2 * s * s;
  const up = 1.2 * s + 4.5 * s * s;
  const x = from.x + from.nx * out, z = from.z + from.nz * out, y = from.y + up;
  // looking the way you were going, and then back
  const k = smooth((t - LEAVE.turn[0]) / (LEAVE.turn[1] - LEAVE.turn[0]));
  const behind = from.cx !== undefined && (from.cx - from.x) * from.nx + (from.cz - from.z) * from.nz < -4;
  const tx = behind ? from.cx : from.x - from.nx * 7, tz = behind ? from.cz : from.z - from.nz * 7, ty = 1;
  // (round by way of straight back, always over the same shoulder: half a turn, and then however far off that the middle is)
  const round = Math.PI + wrap(Math.atan2(-(tx - x), -(tz - z)) - from.yaw - Math.PI);
  const down = Math.atan2(ty - y, Math.hypot(tx - x, tz - z));
  const white = smooth((t - LEAVE.white[0]) / (LEAVE.white[1] - LEAVE.white[0]));
  return {
    x, y, z, out,
    yaw: from.yaw + round * k,
    pitch: from.pitch + (down - from.pitch) * k,
    roll: Math.sin(k * Math.PI) * 0.16,
    white,
    snow: Math.max(0, 1 - Math.abs(t - LEAVE.through * 0.8) / 0.16) * 0.75,       // the moment of the wall itself is not on the tape
    track: t < 0.9 ? 1 : 0.2 + 0.6 * white,
    outside: t >= LEAVE.through * 0.8,
    over: t >= LEAVE.over,
  };
}
