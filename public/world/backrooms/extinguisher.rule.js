// The Backrooms — the fire extinguisher, as a rule. Pure: no three.js, nothing of the page, no Math.random.
//
// A red one off a wall, half full. It hurts nothing and ends nothing. Squeeze it and a cone of white goes out in front,
// a couple of metres; what it catches in the face stops where it is for a few seconds, and then backs off a little
// before it is what it was. It buys a moment. It is not a way of standing your ground (the owner: "agency without
// making it a run and gun"):
//
//   · there is not much in one (EXTINGUISHER.charge seconds of spray), the gauge says how much, and it does not refill;
//   · the same thing sprayed again stops for less each time (`stops`), and forgets only after a while (`forgets`);
//   · the white it leaves hangs in the air in front of you (`cloud`): you cannot see through it (`blind`), and for the
//     ones that come when you are not looking, standing in it is not looking;
//   · and it puts a fire out (`douses`): your own paper fire too, if you spray across it.
//
// How each of the cast takes it is in RESPONSES (one line each, held by a test); what it does to one is its own
// (its `doused()`), and a creature that says nothing is stopped by the conductor (pursuer.js c.stall) like a shove.

export const EXTINGUISHER = Object.freeze({
  charge: 8,                 // seconds of spray in a full one
  found: Object.freeze([0.45, 1]),   // …and how full one is when found (a share of that): never empty
  burst: 0.45,               // seconds one press sprays at least (a tap, a key, a finger: a burst)
  reach: 2.6,                // metres from the nozzle to the edge of what it reaches
  cone: 0.3,                 // radians off straight ahead (before a thing's own width is allowed for)
  verticalReach: 1.5,        // metres above or below the camcorder
  takes: 0.15,               // seconds in the spray before it counts (a lick of it across one is not a face full)
  stops: Object.freeze([4, 2.5, 1.2]),  // seconds it stands, the first time, the second, and every time after
  backs: Object.freeze([2, 1.4, 0.8]),  // seconds it then backs off, the same way
  backSpeed: 1.1,            // metres a second, backing off (away from where the spray came from)
  forgets: 30,               // seconds without being sprayed before it is taken as fresh again
  heavy: 0.5,                // a heavy one (cast.js `heavy`) or one a part belongs to (a boss) stops for this share, and does not back off
  douses: 0.3,               // seconds of spray across a paper fire before it is out
  cloud: Object.freeze({
    life: 3.2,               // seconds one puff of it lasts in the air (most of it hanging there, thinning)
    grows: Object.freeze([0.1, 0.8]),     // metres across, as it leaves the nozzle and as it ends
    speed: 5.5,              // metres a second as it leaves the nozzle…
    drag: 2.6,               // …slowing by this much (a share a second, exp)
    rise: 0.12,              // metres a second it drifts up as it slows
    thick: 0.5,              // how white the picture goes, at most, standing in it
    blind: 0.28,             // …and from this white on, nothing a little way off can be seen through it
  }),
});

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (v) => { const k = clamp01(v); return k * k * (3 - 2 * k); };

/** One, as it is found: how full (seconds), from a draw 0…1 (the floor's dice). */
export const foundCharge = (u = 1) => +(EXTINGUISHER.charge * (EXTINGUISHER.found[0] + (EXTINGUISHER.found[1] - EXTINGUISHER.found[0]) * clamp01(u))).toFixed(2);

/** The trigger at rest. */
export const idle = () => ({ on: false, left: 0, t: 0, sprayed: 0 });

/**
 * One moment of the trigger.
 * @param s       idle() or the last call's
 * @param input   { pressed: it went down this moment · held: it is down now · charge: seconds left in it }
 * @returns { on: spraying now, left: seconds of the burst still owed, t: seconds this burst has gone, sprayed: seconds of
 *            charge it used this moment, began, ended, empty: it ran out in this moment }
 */
export function trigger(s, dt, input = {}) {
  const o = { ...s, began: false, ended: false, empty: false, sprayed: 0 };
  if (!(dt > 0)) return o;
  const charge = Math.max(0, input.charge ?? 0);
  if (input.pressed && charge > 0) { if (!s.on) { o.began = true; o.t = 0; } o.on = true; o.left = Math.max(s.left, EXTINGUISHER.burst); }
  if (!o.on) return o;
  if (charge <= 0) return { ...o, on: false, left: 0, ended: true, empty: true };
  const use = Math.min(dt, charge);
  o.sprayed = use; o.t = s.on ? s.t + dt : dt; o.left = Math.max(0, o.left - dt);
  if (use >= charge) return { ...o, on: false, left: 0, ended: true, empty: true };
  if (o.left <= 0 && !input.held) return { ...o, on: false, ended: true };
  return o;
}

/**
 * Is it in the spray? In front, near, within the cone (its own width allowed for), at about the camcorder's height.
 * @param me  { x, z, y?, yaw }   (yaw as player.js has it: facing -sin, -cos)
 * @param it  { x, z, y?, r? }
 * @returns metres to its edge, or -1: not in it
 */
export function inSpray(me, it) {
  if (!me || !it || !Number.isFinite(it.x) || !Number.isFinite(it.z)) return -1;
  const E = EXTINGUISHER, r = Math.max(0, it.r ?? 0.3), dx = it.x - me.x, dz = it.z - me.z, d = Math.hypot(dx, dz), edge = Math.max(0, d - r);
  if (edge > E.reach) return -1;
  if (it.y !== undefined && Number.isFinite(me.y) && Math.abs(it.y - me.y) > E.verticalReach) return -1;
  if (d < 0.25) return edge;
  const fx = -Math.sin(me.yaw || 0), fz = -Math.cos(me.yaw || 0), off = Math.acos(Math.max(-1, Math.min(1, (fx * dx + fz * dz) / d)));
  return off <= E.cone + Math.atan2(r, d) ? edge : -1;
}

/**
 * What a face full does to it, by how many it has had (and not forgotten) and what it is.
 * @param times  how many times before this one (0: the first)
 * @param kind   { heavy?: cast.js heavy, tier?: 'basic' | 'medium' | 'boss' (cast/health.rule.js) }
 * @returns { stop: seconds it stands, back: seconds it backs off after }
 */
export function doseOf(times = 0, kind = {}) {
  const E = EXTINGUISHER, i = Math.max(0, Math.min(E.stops.length - 1, Math.floor(times)));
  const big = !!kind.heavy || kind.tier === 'boss';
  return { stop: +(E.stops[i] * (big ? E.heavy : 1)).toFixed(3), back: big ? 0 : E.backs[i] };
}

/**
 * The tally of one thing's sprayings: how long it has been in the spray this burst, how many times it has been stopped,
 * and when last. Call every moment for each thing the spray may reach.
 * @param m     what the last call gave (or nothing: fresh)
 * @param now   seconds (the floor's clock)
 * @param hit   it is in the spray this moment
 * @returns { m: the new tally, dosed: this moment it has had its face full (do what doseOf says, with m.times - 1) }
 */
export function tally(m, dt, now, hit) {
  const E = EXTINGUISHER;
  let n = m ? { ...m } : { soak: 0, times: 0, last: -Infinity, until: -Infinity };
  if (now - n.last > E.forgets && n.times > 0 && now >= n.until) n = { ...n, times: 0 };
  if (!hit) return { m: { ...n, soak: 0 }, dosed: false };
  if (now < n.until) return { m: n, dosed: false };                     // (stopped already: more of it is wasted on it)
  n.soak += dt > 0 ? dt : 0;
  if (n.soak < E.takes) return { m: n, dosed: false };
  return { m: { ...n, soak: 0, times: n.times + 1, last: now, until: now }, dosed: true };
}

/** Once doseOf has been done to it: it is not dosed again until it is moving again. */
export const stoppedUntil = (m, now, dose) => ({ ...m, until: now + dose.stop + dose.back });

/** Is a fire put out? `soaked`: seconds of spray across it so far. */
export const doused = (soaked) => soaked >= EXTINGUISHER.douses;

/**
 * One puff of it, `age` seconds after it left the nozzle (pure: the drawing in spray.js follows this).
 * @returns { dist: metres it has come, size: metres across, alpha: 0…1, rise: metres up } — or null once it has gone
 */
export function puffAt(age) {
  const C = EXTINGUISHER.cloud;
  if (!(age >= 0) || age >= C.life) return null;
  const k = age / C.life;
  return {
    dist: (C.speed / C.drag) * (1 - Math.exp(-C.drag * age)),
    size: C.grows[0] + (C.grows[1] - C.grows[0]) * (1 - (1 - k) * (1 - k)),
    alpha: (0.35 + 0.65 * smooth(age / 0.1)) * (1 - smooth((k - 0.3) / 0.7)) * 0.7,
    rise: C.rise * age * age,
  };
}

/**
 * How white the picture goes standing in it: `thick` is how much of the cloud is round the camera (the sum, over the
 * puffs, of how opaque each is and how far inside it the camera is: spray.js). → 0…EXTINGUISHER.cloud.thick
 */
export function whiteOut(thick) {
  if (!(thick > 0)) return 0;
  return EXTINGUISHER.cloud.thick * (1 - Math.exp(-thick * 2.2));
}

/** Seen through: from where the white is this thick, nothing a little way off is seen (index.js sees). */
export const blinds = (white) => white >= EXTINGUISHER.cloud.blind;

/**
 * How each of the cast takes a face full. `stops`: the conductor stands it (c.stall) for doseOf's stop, and it carries on
 * as it was — `backs`: …and then it backs off — `own`: it says what (its own `doused()`) — `nothing`: it does not care.
 */
export const RESPONSES = Object.freeze({
  pirate: 'backs: it stands blinking, then goes back the way it came; looked away from in the white, it is coming again',
  shadow: 'backs: the spray goes through it, and it is gone a moment, as a shadow is in a sudden light',
  intern: 'backs: it stops in the white, and backs off with its hands up',
  toner: 'backs: it gags in it and backs off; it stops coming while it does',
  'toner-brood': 'backs: a hatchling is put back, the same as its parent',
  'trunk-line': 'backs: it stands and lets its cables hang, then draws back',
  'middle-manager': 'own: it is put off swelling and stands — but aiming at it is looking it in the eye, a meeting, until the white is up between you',
  'sticky-notes': 'own: whatever notes the spray catches come down wet and lie stuck to the floor a long while',
  mother: 'stops: half as long, and it does not back off: it is a part of the building',
  'mother-brood': 'backs: a small one of hers is put back',
  'the-lines': 'stops: half as long, and it does not back off',
  'standing-meeting': 'stops: half as long, and it does not back off',
  'carried-interest': 'stops: half as long, and it does not back off',
  'head-count': 'stops: half as long, and it does not back off',
  moth: 'nothing: it is a moth',
  porter: 'nothing: he has seen worse on his rounds',
  'other-door': 'nothing: a door',
  dummies: 'nothing: they are shop dummies',
});

/** What RESPONSES says, as one word: 'stops' | 'backs' | 'own' | 'nothing' (anybody not in it: 'backs'). */
export const responseOf = (id) => (RESPONSES[id] || 'backs:').split(':')[0];
