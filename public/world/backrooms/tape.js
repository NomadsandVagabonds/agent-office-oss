// The Backrooms — the tape. Pure: no three.js, no DOM.
//
// A tape deck in a room records the visitor for as long as its tape is: where
// they stood and where they looked, ten times a second. Then it plays them
// back as a figure, and when the tape runs out the figure holds its last
// frame. The figure is two things, and both are the visitor's own:
//
//   a body   it counts wherever a body counts (a desk that wants somebody at it)
//   eyes     what it faces is being looked at (a screen that wants watching; a
//            cardboard colleague, who only moves while nobody is looking)
//
// It is not solid to the visitor and it cannot hurt or be hurt. One deck, one
// tape: recording again wipes it.
//
// Nothing here is a room. This is the rule the tape rooms share
// (docs/backrooms-lab/TAPE.md), kept where a test can run it against a
// made-up clock: test/backrooms-tape.test.mjs walks each room's solution, and
// the wrong ways of doing it, through these functions.

export const TAPE = Object.freeze({
  seconds: 12,      // how long a tape is, unless a room rolls another
  hz: 10,           // frames kept a second
  halfFov: 0.62,    // half of what a figure (or a visitor) takes in, radians: about what the camcorder shows
  far: 30,          // nobody is looking at anything further off than this
  keep: 0.9,        // how near a cardboard colleague comes to whoever it is coming to
  walk: 1.2,        // how fast one moves, metres a second, while nobody is looking
  patience: 0.5,    // seconds unwatched before one stirs
});

/** The way somebody at `yaw` is facing, as a unit vector [x, z]. (As the player's yaw: 0 looks down −z.) */
export const facing = (yaw) => [-Math.sin(yaw), -Math.cos(yaw)];
/** The yaw that faces from a to b. */
export const yawTo = (ax, az, bx, bz) => Math.atan2(-(bx - ax), -(bz - az));
const inBox = (x, z, b, pad = 0) => x > b[0] - pad && x < b[2] + pad && z > b[1] - pad && z < b[3] + pad;

/** Is the straight line from a to b clear of every solid ([x0, z0, x1, z1] boxes)? */
export function clearLine(ax, az, bx, bz, solids = []) {
  const n = Math.max(2, Math.ceil(Math.hypot(bx - ax, bz - az) / 0.15));
  for (let i = 1; i < n; i++) { const t = i / n, x = ax + (bx - ax) * t, z = az + (bz - az) * t; if (solids.some((b) => inBox(x, z, b))) return false; }
  return true;
}

/** Is somebody at `w` ({ x, z, yaw }) looking at the spot (x, z)? In front of them, near enough, and nothing in between. */
export function looksAt(w, x, z, solids = [], opt = {}) {
  const dx = x - w.x, dz = z - w.z, d = Math.hypot(dx, dz);
  if (d > (opt.far ?? TAPE.far)) return false;
  if (d < 0.35) return true;
  const [fx, fz] = facing(w.yaw);
  if ((fx * dx + fz * dz) / d < Math.cos((opt.halfFov ?? TAPE.halfFov) + Math.atan2(opt.radius ?? 0.3, d))) return false;
  return clearLine(w.x, w.z, x, z, solids);
}

/** A blank tape, `seconds` long. */
export const blank = (seconds = TAPE.seconds) => ({ seconds, frames: [], state: 'blank', t: 0, last: -1 });

/** Start recording: whatever was on it is gone. */
export const rec = (tape) => ({ ...tape, frames: [], state: 'rec', t: 0, last: -1 });

/**
 * One moment of recording. Keeps a frame every 1/hz seconds; when the tape is full it rewinds and plays by itself.
 * @param pose { x, z, yaw }   where the visitor is and which way they face
 * @param used anything they did this moment that a room cares about (an id), or null
 */
export function record(tape, dt, pose, used = null) {
  if (tape.state !== 'rec') return tape;
  const t = tape.t + dt, frames = tape.frames.slice();
  let last = tape.last;
  while ((last + 1) / TAPE.hz <= t && (last + 1) / TAPE.hz <= tape.seconds) { last++; frames.push({ x: pose.x, z: pose.z, yaw: pose.yaw, used: null }); }
  if (used && frames.length) frames[frames.length - 1] = { ...frames[frames.length - 1], used };
  return t >= tape.seconds ? { ...tape, frames, state: 'play', t: 0, last: -1 } : { ...tape, frames, t, last };
}

/**
 * One moment of playback.
 * @returns {{ tape, figure: {x, z, yaw, held}|null, used: string[] }}  the figure (null for a tape with nothing on it), and
 *          whatever it did in this moment that the visitor did then. Once the tape has run out the figure holds its last frame.
 */
export function play(tape, dt) {
  if (tape.state !== 'play' || !tape.frames.length) return { tape, figure: null, used: [] };
  const t = tape.t + dt, n = tape.frames.length, at = Math.min(n - 1, Math.floor(t * TAPE.hz)), used = [];
  for (let i = tape.last + 1; i <= at; i++) if (tape.frames[i].used) used.push(tape.frames[i].used);
  const a = tape.frames[at], b = tape.frames[Math.min(n - 1, at + 1)], k = Math.min(1, Math.max(0, t * TAPE.hz - at));
  let turn = b.yaw - a.yaw; turn = Math.atan2(Math.sin(turn), Math.cos(turn));
  const held = at >= n - 1;
  return { tape: { ...tape, t, last: at }, figure: { x: a.x + (b.x - a.x) * (held ? 0 : k), z: a.z + (b.z - a.z) * (held ? 0 : k), yaw: a.yaw + turn * (held ? 0 : k), held }, used };
}

/** Is a body standing on this mat ({ x, z, r })? */
export const onMat = (mat, body) => !!body && Math.hypot(body.x - mat.x, body.z - mat.z) <= mat.r;

/**
 * A desk is attended while somebody is on its mat and is looking at its screen. A cardboard colleague on the mat counts:
 * cardboard faces whoever it was last coming to.
 * @param desk  { mat: { x, z, r }, screen: { x, z } }
 * @param people  everybody who is a body with eyes: the visitor, the figure, the cardboard ({ x, z, yaw })
 */
export const attended = (desk, people, solids = []) => people.some((p) => p && onMat(desk.mat, p) && looksAt(p, desk.screen.x, desk.screen.z, solids, { halfFov: 0.9 }));

/**
 * One moment of a cardboard colleague. It only moves while nobody is looking at it, and then it comes to whoever is nearest.
 * @param k        { x, z, yaw, unseen }
 * @param watchers everybody with eyes who is not cardboard: the visitor, and the figure on the tape ({ x, z, yaw })
 * @param solids   boxes it cannot stand in
 * @returns the colleague, a moment later (a new object; `watched` says whether anybody had eyes on it)
 */
export function colleague(k, dt, watchers, solids = [], opt = {}) {
  const who = watchers.filter(Boolean);
  if (who.some((w) => looksAt(w, k.x, k.z, solids))) return { ...k, unseen: 0, watched: true };
  const unseen = (k.unseen || 0) + dt;
  if (unseen < (opt.patience ?? TAPE.patience) || !who.length) return { ...k, unseen, watched: false };
  const to = who.slice().sort((a, b) => Math.hypot(a.x - k.x, a.z - k.z) - Math.hypot(b.x - k.x, b.z - k.z))[0];
  const dx = to.x - k.x, dz = to.z - k.z, d = Math.hypot(dx, dz) || 1, keep = opt.keep ?? TAPE.keep;
  const step = Math.min((opt.walk ?? TAPE.walk) * dt, Math.max(0, d - keep));
  const x = k.x + (dx / d) * step, z = k.z + (dz / d) * step;
  if (step > 0 && solids.some((b) => inBox(x, z, b, 0.2))) return { ...k, yaw: yawTo(k.x, k.z, to.x, to.z), unseen, watched: false };
  return { ...k, x, z, yaw: yawTo(x, z, to.x, to.z), unseen, watched: false };
}
