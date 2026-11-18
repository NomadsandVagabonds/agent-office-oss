// The Backrooms — water (the Graphics setting's `water`, graphics.js): the numbers, the small decisions and the shader
// text of the surface that replaces a room's water sheet at Medium and High. No three.js in here: the tests read it,
// and liquid.js draws with it.
//
// A room marks a sheet it drew as a liquid's surface (world.js `c.liquid`). Where the tier has water and the sheet is
// flat, liquid.js puts a second mesh on the same geometry with this surface, and the camcorder draws the scene in two
// halves while one is in view (vhs.js): everything opaque, then a copy of that picture and its depth, then the water
// (reading the copy), then everything see-through, then what is held. The surface:
//   - what is under it, seen through it: the copy's colour, nudged by the ripple, darkened and tinted by how much water
//     the eye looks through to reach it (the copy's depth less the surface's), red going first, so a bed goes
//     blue-green with depth and what stands in it (floats, legs) shows under the surface;
//   - a pale line where the surface meets what walls it in or stands in it (the copy's depth just behind the surface);
//   - a ripple stepped to cells of the room's own frame (not the world's grid): a height worked out at the middle of a
//     cell and its neighbours, the slope between them stepped, so it moves in blocks; a room's phase drifts it;
//   - fresnel toward a flat tint of the room's light (reflection()), or at High toward the room mirrored in it (MIRROR,
//     below: one planar mirror a frame, for the water level nearest the eye);
//   - lit by the room's light as the old sheet was, its own baked light with the room's dimmer, flicker and banks: a
//     pool in a room that has gone dark is dark.
//   - the wake: rings where something disturbed it (handle.disturb, liquid.mark.js; the visitor wading, liquid.js
//     feel), each a short train of waves spreading at a fixed speed, fading with age and with the distance it has gone.
//     Its slope is added to the ripple's on cells of its own (the ripple's 5 cm near, 10 and 20 cm further off, so it
//     stays in blocks where the ripple's own cells lie flat), so it bends the bed in blocks; its crest is a broken band
//     of brighter cells, a darker trough just behind it, and the light on the bed is stirred inside a fresh one. A small
//     pool of them a surface (uRings, uRingN); none set, the surface is exactly as it was without them.

export const LIQUID = Object.freeze({
  flat: 0.01,         // metres: a sheet is flat if its corners span less than this, up and down, in its room's frame
  under: 0.02,        // metres: the eye below the surface plus this is under it (the room's own sheet and veil are drawn)
  hold: 0.5,          // seconds the two-part draw is kept after the last frame a surface was in view
  margin: 0.05,       // metres the surface's box is grown by, up and down, for that test (the ripple and the line)
  cell: 0.05,         // metres: the ripple's cells, in the room's frame
  ripple: 2.5,        // the slow waves' height, of the look-dev lab's
  slopeStep: 0.03,    // the ripple's slope is stepped to this
  sharp: Object.freeze([2, 6]),   // pixels a cell spans where its slope starts to show, and shows in full (smaller cells, far off, lie flat: no speckle)
  refract: 0.5,       // how far the ripple's tilt moves what is seen under it, of the picture, per metre of water
  refractMost: 0.4,   // (metres of water past which it moves no further)
  edge: 0.06,         // metres: water this thin over what is behind it is the line where it meets something (fading out from half of it)
  edgeMix: 0.85,
  edgeColor: Object.freeze([0.86, 0.95, 0.97]),
  f0: 0.02,           // the share it mirrors looking straight down
  sky: 0.1,           // the flat tint it mirrors, of the room's light at the surface
  drift: Object.freeze([0.06, 0.02]),   // metres the ripple moves for each unit of a room's phase
  absorb: 0.15,       // per metre: how fast the clearest channel goes, through a sheet as see-through as the waterpark's
  absorbAlpha: 0.52,  // (the old sheet's opacity that absorb is for: a murkier sheet absorbs much faster, as the seventh power:
  murkPower: 7,       //  the green rooms' 0.63 and 0.82 sheets stay murk, the waterpark's 0.52 and 0.56 stay clear)
  absorbSpread: 4,    // how much faster the channels the water's tint has least of go
  deep: 0.3,          // what a long way through it looks like, of the sheet's own colour (lit by the room)
  scatter: 0.3,       // the water's own colour, lit by the room, that even a little of it gives (of the sheet's colour): a pool
  scatterDepth: 4,    //  reads as coloured water over its bed, not as clear glass (per metre: e^- of how fast it comes in)
  scatterFade: 0.5,   //  and per metre it gives way again to what is behind it, so a deep pool is not a fog
  keep: 0.3,          // per metre: however much it absorbs, a clear sheet's water lets at least e^-(this × murk²) of what is
                      //  behind it through in the water's own colours (2 m of the waterpark's: 55 % in its clearest channel)
  glowKeep: 0.6,      // of what water takes off something that lights itself (brighter than the room's light there), given back
  saturate: 1.6,      // (the sheet's picture averages its pale caustic lines in: its colour is pushed back out by this)
  // the caustics: light playing on what is under the water, worked out where the eye's ray reaches it (no picture read).
  // Two layers of an iterated wave pattern at different scales, moving with the clock in different directions; where
  // their bright lines cross they are brighter. On 5 cm cells, bent by the ripple's slope, softer and wider with depth
  caustic: 1.3,       // how much brighter the brightest of it makes what it lands on (it only ever brightens, never tints)
  causticCell: 0.05,  // metres: its cells, in the room's frame
  causticScale: Object.freeze([8.3, 5.9]),   // the two layers' scales (radians per metre; never a whole multiple of each other)
  causticSpeed: Object.freeze([0.9, 0.67]),  // and how fast each changes shape with the clock
  causticBend: 1.5,   // how far the ripple's slope moves it, per metre of water over it
  causticSharp: Object.freeze([8, 3]),       // how sharp its lines are in shallow water, and at 2 m (lower is softer and wider)
  causticFade: 0.35,  // per metre of a clear sheet's water it fades by (e^-, times the murk squared: the dark pools show none)
  causticDrift: Object.freeze([0.06, 0.02]), // metres it drifts for each unit of a room's phase, as the ripple does
  // the wake: rings where something disturbed the water (x, z in the room's frame, its age by the camcorder's clock, strength)
  rings: 8,           // a surface's slots (the shader's array): when full, the faintest is replaced
  wakeSpeed: 0.42,    // metres a second its front spreads
  wakeFrom: 0.14,     // metres: its front's radius when it starts (about a body's)
  wakeLife: 2.6,      // seconds: it fades to nothing at this age (smoothly, to no slope at all: it is dropped then, with nothing to pop)
  wakeDamp: 0.5,      // per second it fades by (e^-), on top of that
  wakeWave: 0.25,     // metres from one of its crests to the next, near (five of the ripple's cells); never under 3 of its own cells
  wakeWaves: Object.freeze([1.5, 3]), // how many of them in its train: each ring's own, between these (jittered: wakeJitter)
  wakeWiden: 0.35,    // its train widens by this, a second
  wakeHeight: 0.012,  // metres high at strength 1
  wakeSpread: 3,      // its height falls as 1/√(1 + this × metres gone): it spreads its energy round a longer ring
  wakeWobble: 1.6,    // how far the ripple's own height moves a ring's front (metres per metre): no ring is a true circle
  wakeMost: 2,        // the strongest a ring may be
  wakeJitter: 0.3,    // a ring's strength is its asking times 1 ± this/2 (from where and when it starts: wakeHash, no seeded stream)
  // the ring has cells of its own: the ripple's 5 cm near, 10 cm and then 20 cm further off, so that it stays in blocks
  // without speckle where the ripple's own cells lie flat (it is not flattened with distance as the ripple is)
  wakePixels: 5,      // pixels a ring's cell should span at least (on average over its two sides, seen at a slant): its
                      //  cells double (to two doublings) until they do
  wakeSlopeStep: 0.04,// its slope, stepped (its own, added to the ripple's)
  // what carries across a pool: light and dark more than the bend
  wakeCrest: 2.2,     // how much brighter its crest makes the water at strength 1, fresh (a broken band: some of its cells)
  wakeCrestCells: 0.35, // (the share of a crest's cells left out)
  wakeTrough: 1.0,    // how much darker the trough just behind the crest
  wakeStir: 0.6,      // the bed inside a fresh ring, brighter by this for its first wakeStirTime seconds (the light stirred)
  wakeStirTime: 0.5,
  wakeNear: Object.freeze([0.8, 3, 0.45]), // metres from the eye: nearer than the first a ring is this much (the third) of
                      //  itself, full from the second (near rings gentler than far: the eye is right over them)
  // the visitor's own wake (liquid.js feel, from index.js once a frame): a ring as they go in, and one for each
  // wadeEvery metres they move through it, as strong as they are quick
  wadeEvery: 0.45,    // metres moved through water between two rings (walking: one about every 0.35 s; running, closer in time)
  wadeMoving: 0.25,   // m/s: slower than this is standing still (player.js `moving`)
  wadeWalk: 1.45,     // m/s: a ring of strength 1 (wading is slowed: player.js WALK 2.05 is about 1.3 m/s in the kiddie lagoon)
  wadeLeast: 0.3,
  wadeMost: 1.3,
  wadeEntry: 1.5,     // the ring as they go in (more for coming in quick)
  wadeDeep: 1.4,      // metres: an eye further than this under the surface is too deep to disturb it
  fallbackTint: Object.freeze([0.03, 0.24, 0.3]),  // linear, for a sheet whose picture cannot be read
});

/** The flat test: the lowest and highest a sheet's corners sit in its room's frame. → { flat, y, height } */
export function flatness(minY, maxY, k = LIQUID) {
  const height = maxY - minY;
  return { flat: Number.isFinite(height) && height < k.flat, y: (minY + maxY) / 2, height };
}

/** Is the eye (its height in the surface's room frame) under a surface at planeY? */
export const underwater = (eyeY, planeY, k = LIQUID) => eyeY < planeY + k.under;

/**
 * The two-part draw's hold: `seen` this frame or not, at time `now` (seconds of the camcorder's own clock). → the next
 * state { last, split }: split while a surface has been in view within the last `hold` seconds, so the draw does not
 * flicker between the two ways at the edge of the picture. `force`: 'split' or 'single' (the dev page's, for checking).
 */
export function holdStep(state, now, seen, force = null, k = LIQUID) {
  const last = seen ? now : state?.last ?? -Infinity;
  const split = force === 'split' ? true : force === 'single' ? false : now - last < k.hold;
  return { last, split };
}

/** What is left of a ring of strength 1 at this age (seconds): 1 when it starts, nothing at wakeLife and after (and before 0). */
export function ringLeft(age, k = LIQUID) {
  if (!(age >= 0) || age >= k.wakeLife) return 0;
  const t = 1 - age / k.wakeLife;
  return Math.exp(-k.wakeDamp * age) * t * t;
}

/** 0…1 from a place and a time (and which of a ring's numbers): the same for the same, no seeded stream read. */
export function wakeHash(x, z, t, i = 0) {
  const v = Math.sin(x * 12.9898 + z * 78.233 + t * 37.719 + i * 4.581) * 43758.5453;
  return v - Math.floor(v);
}

/**
 * A disturbance: a ring starts at x, z (the surface's room frame) at `now` (seconds of the camcorder's clock), into
 * `pool` (an array, a surface's). Full, the faintest is replaced (the oldest, of rings as strong). → whether one started.
 */
export function wakeStart(pool, x, z, strength, now, k = LIQUID) {
  const s0 = Math.min(k.wakeMost, Number(strength));
  if (!Array.isArray(pool) || !Number.isFinite(x) || !Number.isFinite(z) || !(s0 > 0) || !Number.isFinite(now)) return false;
  // (each ring a little its own: its strength and how many waves it has, from where and when it starts)
  const s = Math.min(k.wakeMost, s0 * (1 + k.wakeJitter * (wakeHash(x, z, now, 1) - 0.5)));
  const n = k.wakeWaves[0] + (k.wakeWaves[1] - k.wakeWaves[0]) * wakeHash(x, z, now, 2);
  const ring = { x, z, t0: now, s, n };
  if (pool.length < k.rings) { pool.push(ring); return true; }
  let at = 0, least = Infinity;
  for (let i = 0; i < pool.length; i++) {
    const left = pool[i].s * ringLeft(now - pool[i].t0, k);
    if (left < least || (left === least && pool[i].t0 < pool[at].t0)) { least = left; at = i; }
  }
  pool[at] = ring;
  return true;
}

/** The pool at `now`: the rings faded to nothing (or from a clock that went back) dropped. → the pool. */
export function wakeStep(pool, now, k = LIQUID) {
  if (!Array.isArray(pool)) return pool;
  let n = 0;
  for (const r of pool) { const age = now - r.t0; if (age >= 0 && age < k.wakeLife) pool[n++] = r; }
  pool.length = n;
  return pool;
}

/**
 * The shader's rings from the pool at `now`: each slot of `out` set to (x, z, age, waves × 4 + strength) (strength is
 * under 4, so the shader takes the two apart). → how many (uRingN).
 */
export function wakeFill(pool, now, out, k = LIQUID) {
  const n = Math.min(pool?.length || 0, out.length, k.rings);
  for (let i = 0; i < n; i++) {
    const r = pool[i], v = out[i], age = now - r.t0, w = Math.round(((r.n ?? LIQUID.wakeWaves[0]) - 1) * 16) * 4 + Math.min(r.s, 3.999);
    if (v.set) v.set(r.x, r.z, age, w); else { v[0] = r.x; v[1] = r.z; v[2] = age; v[3] = w; }
  }
  return n;
}

/**
 * The visitor's own wake, once a frame: `wet` whether they are in a surface's water, `speed` how quick (m/s), `now` the
 * camcorder's clock. → { state, ring }: ring the strength of a ring to start where they are (0 for none). One as they go
 * in; then one for each wadeEvery metres moved through it (speed × time), as strong as they are quick: a walk lays them
 * further apart in time than a run. A clock that stands still (paused) starts nothing.
 */
export function wadeStep(state, { wet = false, speed = 0, now = 0 } = {}, k = LIQUID) {
  const was = state || { wet: false, acc: 0, last: now };
  const dt = Math.max(0, Math.min(0.25, now - (Number.isFinite(was.last) ? was.last : now)));
  const v = Number(speed) || 0, quick = Math.max(k.wadeLeast, Math.min(k.wadeMost, v / k.wadeWalk));
  if (!wet) return { state: { wet: false, acc: 0, last: now }, ring: 0 };
  if (!was.wet) return { state: { wet: true, acc: 0, last: now }, ring: Math.min(k.wakeMost, k.wadeEntry + 0.3 * quick) };
  let acc = was.acc, ring = 0;
  if (v > k.wadeMoving) { acc += v * dt; if (acc >= k.wadeEvery - 1e-9) { acc = Math.max(0, acc - k.wadeEvery); ring = quick; } }
  return { state: { wet: true, acc: Math.min(acc, k.wadeEvery), last: now }, ring };
}

/** sRGB (0…1) to linear, as the picture's texture is read. */
export const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));

/**
 * The water's own colours, from the sheet it replaces: `tint` its picture's average (linear) times its vertex colour,
 * `alpha` its opacity. → { deep, absorb }: deep is what a long way through it looks like (lit by the room), absorb how
 * fast each channel goes per metre (the channels the tint has least of first, and all faster in a murkier sheet).
 */
export function waterColours(tint, alpha = LIQUID.absorbAlpha, k = LIQUID) {
  const t = Array.isArray(tint) && tint.length === 3 && tint.every((v) => Number.isFinite(v) && v >= 0) && Math.max(...tint) > 0 ? tint : k.fallbackTint;
  const grey = 0.299 * t[0] + 0.587 * t[1] + 0.114 * t[2];
  const c = t.map((v) => Math.max(0, grey + (v - grey) * k.saturate));
  const top = Math.max(...c, 1e-6), murk = Math.pow(Math.max(0.2, Math.min(1, alpha)) / k.absorbAlpha, k.murkPower);
  return { deep: c.map((v) => v * k.deep), scatter: c.map((v) => v * k.scatter), keep: c.map((v) => v / top), keepRate: k.keep * murk * murk, absorb: c.map((v) => k.absorb * murk * (1 + k.absorbSpread * (1 - v / top))) };
}

// ---- the mirror (water 2, High) ----
// One planar reflection a frame: for the marked surface nearest the eye that is in view, faces up and has the eye above
// it, the room is drawn once more mirrored about that surface's plane (liquid.js mirrorPass), with an oblique near
// plane at the water so nothing under the surface is drawn into it, into a picture of its own; every surface on that
// same plane samples it in reflection(), weighted by the fresnel term the surface already had. No three.js here: plain
// arrays of sixteen, column by column, as three.js's Matrix4.elements are.
export const MIRROR = Object.freeze({
  scale: 0.5,         // the mirror's picture, of the scene's own target each way (High at Full VHS: 1440 × 1080 → 720 × 540,
                      //  the tape's own size: anything finer is lost to the tape; the ripple's wobble blurs it further)
  above: 0.05,        // metres: the eye must be this far over the plane (nearer, the clip plane runs through the eye)
  switchBy: 1,        // metres: another water level takes the mirror only when it is this much nearer (no flicker between two)
  samePlane: 0.01,    // metres: surfaces this close to the chosen one's plane share its mirror (one water level)
  wobble: 0.3,        // how far the lookup moves, of the picture, per unit of the ripple's (stepped) tilt
  cap: 2.5,           // its brightest, as times the room's light at the surface (a tube a patch, not a bar) ...
  capLeast: 0.4,      //  ... and at least this
  dim: 0.85,          // what the water gives back of it (on top of fresnel)
  tint: 0.35,         // how far it is taken toward the water's own colour
});

/** A plane through `point` facing along `normal` (both [x, y, z]): → [nx, ny, nz, d], n·p + d = 0, n of length 1. */
export function mirrorPlane(normal, point) {
  const l = Math.hypot(normal[0], normal[1], normal[2]) || 1, n = normal.map((v) => v / l);
  return [n[0], n[1], n[2], -(n[0] * point[0] + n[1] * point[1] + n[2] * point[2])];
}

/** The matrix that mirrors space about a plane [nx, ny, nz, d] (column by column): I − 2nnᵀ, and −2dn. */
export function reflectMatrix(plane) {
  const [x, y, z, d] = plane;
  return [1 - 2 * x * x, -2 * x * y, -2 * x * z, 0, -2 * x * y, 1 - 2 * y * y, -2 * y * z, 0, -2 * x * z, -2 * y * z, 1 - 2 * z * z, 0, -2 * d * x, -2 * d * y, -2 * d * z, 1];
}

/** A plane [nx, ny, nz, d] taken into a camera's space by its (rigid) view matrix: → the same plane there. */
export function planeInView(plane, view) {
  const e = view, [x, y, z, d] = plane;
  const n = [e[0] * x + e[4] * y + e[8] * z, e[1] * x + e[5] * y + e[9] * z, e[2] * x + e[6] * y + e[10] * z];
  return [n[0], n[1], n[2], d - (n[0] * e[12] + n[1] * e[13] + n[2] * e[14])];
}

/**
 * A perspective projection (sixteen, column by column) with its near plane moved onto `clip` (a plane in the camera's
 * space, [nx, ny, nz, d], the camera on its far side): what is behind the plane is clipped, as near as the near plane
 * would be. Only its third row changes, so where a point lands in the picture (x, y and w) is as it was. → a new array.
 */
export function obliqueProjection(P, clip) {
  const q = [(Math.sign(clip[0]) + P[8]) / P[0], (Math.sign(clip[1]) + P[9]) / P[5], -1, (1 + P[10]) / P[14]];
  const k = 2 / (clip[0] * q[0] + clip[1] * q[1] + clip[2] * q[2] + clip[3] * q[3]);
  const out = P.slice();
  out[2] = clip[0] * k; out[6] = clip[1] * k; out[10] = clip[2] * k + 1; out[14] = clip[3] * k;
  return out;
}

/** The mirror's picture for a scene target w × h: → [w, h], at least 1 each way. */
export const mirrorSize = (w, h, k = MIRROR) => [Math.max(1, Math.round(w * k.scale)), Math.max(1, Math.round(h * k.scale))];

/**
 * Which water level has the mirror this frame. `cands`: the surfaces that may have it ({ rec, dist }: in view, facing
 * up, the eye at least `above` over it; dist metres from the eye to it), `prev` the one that had it last frame. The
 * nearest, unless last frame's still may and is not `switchBy` further than it. → a rec, or null.
 */
export function pickMirror(cands, prev = null, k = MIRROR) {
  let best = null;
  for (const c of cands || []) if (c && Number.isFinite(c.dist) && (!best || c.dist < best.dist)) best = c;
  if (!best) return null;
  const kept = prev ? (cands || []).find((c) => c && c.rec === prev) : null;
  return kept && kept.dist - best.dist < k.switchBy ? kept.rec : best.rec;
}

/**
 * Is a thing left out of the mirror: → why ('noReflect', 'liquid', 'held', 'detail'), or null (drawn in it). `noReflect`
 * (userData.noReflect = true, on a mesh or a group: everything in it) is the mark any builder may set; the rest are the
 * water itself, what is held in front of the camera (renderOrder from HELD_ORDER: hand.js), and a room's detail batches.
 */
export function mirrorLeaves(o, heldOrder = 10000) {
  if (!o) return null;
  const u = o.userData || {};
  if (u.noReflect) return 'noReflect';
  if (u.liquid) return 'liquid';
  if ((o.renderOrder || 0) >= heldOrder) return 'held';
  if (u.detail) return 'detail';
  return null;
}

const f = (n) => Number(n).toFixed(6);
const v3 = (a) => `vec3(${a.map(f).join(', ')})`;

/** The vertex shader: the sheet's own baked light (kit.js VERT's sum, the same attributes and uniforms), where it is in its room. */
export const LIQUID_VERT = `
attribute vec3 aLit;
#ifdef BANKS
attribute vec3 aBank0;
attribute vec3 aBank1;
uniform vec2 uBanks;
#if BANKS > 2
attribute vec3 aBank2;
uniform vec2 uMoreBanks;
#endif
#if BANKS > 3
attribute vec3 aBank3;
#endif
#endif
#ifdef FLICK
attribute vec3 aFlk;
#endif
uniform float uFlick;
uniform float uDim;
uniform vec3 uTint;
uniform mat4 uToRoom;
varying vec3 vLit;
varying vec3 vRoom;
varying vec3 vView;
void main() {
  vec3 lit = aLit;
  #ifdef BANKS
  lit += aBank0 * uBanks.x + aBank1 * uBanks.y;
  #if BANKS > 2
  lit += aBank2 * uMoreBanks.x;
  #endif
  #if BANKS > 3
  lit += aBank3 * uMoreBanks.y;
  #endif
  #endif
  #ifdef FLICK
  lit += aFlk * uFlick;
  #endif
  vLit = lit * uDim * uTint;
  vRoom = (uToRoom * vec4(position, 1.0)).xyz;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vView = mv.xyz;
  gl_Position = projectionMatrix * mv;
}`;

/** The fragment shader. tScene and tDepth: the copy of the scene drawn so far (everything opaque), at its size uSize. */
export const LIQUID_FRAG = `
uniform sampler2D tScene;
uniform sampler2D tDepth;
uniform vec2 uSize;
uniform vec2 uClip;
uniform float uTime;
uniform float uPhase;
uniform mat3 uRoomToView;
uniform vec3 uDeep;
uniform vec3 uAbsorb;
uniform vec3 uScatter;
uniform vec4 uKeep;
uniform float uCaustic;
uniform vec3 uEyeRoom;
uniform vec4 uRings[${LIQUID.rings}];
uniform int uRingN;
varying vec3 vLit;
varying vec3 vRoom;
varying vec3 vView;
// one ring of the wake at p, on cells rc wide: (its height, its crest, its trough, the light it stirs inside it). w: x, z,
// age, waves × 4 + strength (wakeFill). Its front at wakeFrom + wakeSpeed × age, moved a little by the ripple's own height
// there (base); its leading crest at the front, a trough just behind, then its other waves, as many as it has; its waves
// never shorter than three of its cells (so far off, on wide cells, it is a band and not speckle); fading with age (to
// nothing at wakeLife) and with the distance gone
vec4 wakeRing(vec2 p, vec4 w, float base, float rc) {
  float q = floor(w.w / 4.0), s = w.w - q * 4.0, waves = q / 16.0 + 1.0;
  float age = w.z, r = length(p - w.xy);
  float front = ${f(LIQUID.wakeFrom)} + ${f(LIQUID.wakeSpeed)} * age + base * ${f(LIQUID.wakeWobble)};
  float d = r - front, lambda = max(${f(LIQUID.wakeWave)}, 3.0 * rc);
  float width = 0.5 * waves * lambda * (1.0 + ${f(LIQUID.wakeWiden)} * age), e = d + 0.4 * width;
  float t = clamp(1.0 - age / ${f(LIQUID.wakeLife)}, 0.0, 1.0);
  float a = s * exp(-${f(LIQUID.wakeDamp)} * age) * t * t * inversesqrt(1.0 + ${f(LIQUID.wakeSpread)} * r);
  float env = a * exp(-e * e / (width * width)) * (1.0 - smoothstep(0.25 * lambda, 0.5 * lambda, d));
  float wave = cos(d * 6.2831853 / lambda);
  return vec4(${f(LIQUID.wakeHeight)} * env * wave,
    env * smoothstep(0.6, 0.95, wave) * smoothstep(-0.5 * lambda, -0.25 * lambda, d),
    env * smoothstep(0.6, 0.95, -wave) * smoothstep(-1.0 * lambda, -0.75 * lambda, d),
    s * (1.0 - smoothstep(0.0, ${f(LIQUID.wakeStirTime)}, age)) * (1.0 - smoothstep(front - 0.05, front, r)));
}
float liquidDepth(float d) { return uClip.x * uClip.y / (uClip.y - d * (uClip.y - uClip.x)); }
// the surface's height at p (the room's frame, metres): a few slow waves, drifted by the room's phase
float liquidHeight(vec2 p) {
  vec2 q = p - vec2(${f(LIQUID.drift[0])}, ${f(LIQUID.drift[1])}) * uPhase;
  float h = ${f(LIQUID.ripple)} * (0.006 * sin(q.x * 3.1 + uTime * 1.3) + 0.005 * sin(q.y * 2.3 - uTime * 1.1) + 0.003 * sin((q.x + q.y) * 5.7 + uTime * 2.1));
  return h;
}
// what the surface mirrors, for a normal and the way to the eye (view space), at this pixel
#ifdef MIRROR
// (High, water 2: the room drawn once more, mirrored about this surface's plane, into a picture of its own: liquid.js
// mirrorPass. uMirror takes a point in the eye's view space to that picture; uMirrorOn is 1 only on the one water level
// that has the mirror this frame, and only inside the camcorder's draw. The lookup is moved by the ripple's stepped
// tilt, so the mirror wobbles in blocks as the bed does; its brightest is held to a few times the room's light here, so
// a ceiling tube stays a patch and is not drawn out into a white bar; dimmed, and taken a little toward the water's own
// colour. A surface without the mirror this frame keeps the flat tint)
uniform sampler2D tMirror;
uniform mat4 uMirror;
uniform float uMirrorOn;
vec3 reflection(vec3 n, vec3 v, vec2 uv, vec3 light) {
  vec3 flatTint = light * ${f(LIQUID.sky)};
  if (uMirrorOn < 0.5) return flatTint;
  vec4 m = uMirror * vec4(vView, 1.0);
  vec3 up = normalize(uRoomToView * vec3(0.0, 1.0, 0.0));
  vec2 q = m.xy / max(m.w, 1e-4) * 0.5 + 0.5 + (n - up).xy * ${f(MIRROR.wobble)};
  vec3 r = texture2D(tMirror, clamp(q, vec2(0.002), vec2(0.998))).rgb;
  float l = dot(r, vec3(0.299, 0.587, 0.114)), cap = max(dot(light, vec3(0.299, 0.587, 0.114)) * ${f(MIRROR.cap)}, ${f(MIRROR.capLeast)});
  r *= min(1.0, cap / max(l, 1e-5));
  return r * ${f(MIRROR.dim)} * mix(vec3(1.0), uKeep.rgb, ${f(MIRROR.tint)});
}
#else
// (Medium, and any surface at High while the mirror is off: a flat tint of the room's light where it is)
vec3 reflection(vec3 n, vec3 v, vec2 uv, vec3 light) { return light * ${f(LIQUID.sky)}; }
#endif
// one layer of the caustics at q (radians), at s: a net of wavy lines (where a warped sum of two waves is near nought)
// whose warp moves with s, so its lines bend, meet and part and never hold one shape. 1 on a line, falling to 0 off it
float causticLayer(vec2 q, float s, float sharp) {
  vec2 w = q + 0.9 * vec2(sin(q.y * 1.3 + s), sin(q.x * 1.1 - s * 0.8));
  float f = sin(w.x) + sin(w.y);
  return exp(-f * f * sharp);
}
// the caustics where the ray reaches what is under the water (p: the room's frame), 0…1, after thick metres of water
// whose ripple has that slope there: two layers, turned against each other and at scales that never line up, brighter
// where their lines cross
float caustic(vec2 p, vec2 slope, float thick) {
  vec2 q = p + slope * ${f(LIQUID.causticBend)} * thick - vec2(${f(LIQUID.causticDrift[0])}, ${f(LIQUID.causticDrift[1])}) * uPhase;
  q = (floor(q / ${f(LIQUID.causticCell)}) + 0.5) * ${f(LIQUID.causticCell)};
  float e = mix(${f(LIQUID.causticSharp[0])}, ${f(LIQUID.causticSharp[1])}, clamp(thick * 0.5, 0.0, 1.0));
  float a = causticLayer(mat2(0.8, -0.6, 0.6, 0.8) * q * ${f(LIQUID.causticScale[0])}, uTime * ${f(LIQUID.causticSpeed[0])}, e);
  float b = causticLayer(mat2(0.28, 0.96, -0.96, 0.28) * q * ${f(LIQUID.causticScale[1])} + vec2(13.7, 5.1), uTime * ${f(LIQUID.causticSpeed[1])} + 2.3, e);
  return clamp(0.35 * (a + b) + a * b, 0.0, 1.0);
}
void main() {
  vec2 uv = gl_FragCoord.xy / uSize;
  // the ripple, on cells of the room's own frame: the slope between this cell and its neighbours, stepped
  const float cell = ${f(LIQUID.cell)};
  vec2 c = (floor(vRoom.xz / cell) + 0.5) * cell;
  float h0 = liquidHeight(c), hx = liquidHeight(c + vec2(cell, 0.0)), hz = liquidHeight(c + vec2(0.0, cell));
  vec2 slope = floor(vec2(hx - h0, hz - h0) / cell / ${f(LIQUID.slopeStep)} + 0.5) * ${f(LIQUID.slopeStep)};
  // (far off, where a cell is a pixel or two, the steps would only be speckle: there it lies flat)
  vec2 fw = fwidth(vRoom.xz);
  slope *= clamp((cell / max(max(fw.x, fw.y), 1e-5) - ${f(LIQUID.sharp[0])}) / ${f(LIQUID.sharp[1] - LIQUID.sharp[0])}, 0.0, 1.0);
  // the wake: its own slope, on cells of its own that widen far off (5, 10, 20 cm: at least wakePixels each) instead of
  // lying flat, added to the ripple's; gentler right under the eye. wk: its height, crest, trough and stirred light here
  vec4 wk = vec4(0.0);
  if (uRingN > 0) {
    float rc = cell * exp2(clamp(ceil(log2(${f(LIQUID.wakePixels)} * sqrt(max(fw.x * fw.y, 1e-10)) / cell)), 0.0, 2.0));
    vec2 rp = (floor(vRoom.xz / rc) + 0.5) * rc;
    float g = mix(${f(LIQUID.wakeNear[2])}, 1.0, smoothstep(${f(LIQUID.wakeNear[0])}, ${f(LIQUID.wakeNear[1])}, distance(vec3(rp.x, vRoom.y, rp.y), uEyeRoom)));
    float wx = 0.0, wz = 0.0;
    for (int i = 0; i < ${LIQUID.rings}; i++) {
      if (i >= uRingN) break;
      wk += wakeRing(rp, uRings[i], h0, rc);
      wx += wakeRing(rp + vec2(rc, 0.0), uRings[i], h0, rc).x;
      wz += wakeRing(rp + vec2(0.0, rc), uRings[i], h0, rc).x;
    }
    slope += floor(vec2(wx - wk.x, wz - wk.x) * g / rc / ${f(LIQUID.wakeSlopeStep)} + 0.5) * ${f(LIQUID.wakeSlopeStep)};
    // (its crest a broken band: some of its cells left out, a fixed scatter of them)
    wk.y *= g * step(${f(LIQUID.wakeCrestCells)}, fract(sin(dot(floor(vRoom.xz / rc), vec2(127.1, 311.7))) * 43758.5453));
    wk.z *= g;
  }
  vec3 up = normalize(uRoomToView * vec3(0.0, 1.0, 0.0));
  vec3 n = normalize(uRoomToView * normalize(vec3(-slope.x, 1.0, -slope.y)));
  vec3 v = normalize(-vView);
  vec2 bend = (n - up).xy;                                   // (only the ripple's tilt moves what is under it)
  // how much water the eye looks through to what is under it: along the ray, from the surface to the copy's depth
  float zw = -vView.z, ray = length(vView) / max(zw, 1e-4);
  float behind = max(liquidDepth(texture2D(tDepth, uv).x) - zw, 0.0) * ray;
  vec2 ruv = clamp(uv + bend * ${f(LIQUID.refract)} * min(behind, ${f(LIQUID.refractMost)}), vec2(0.5) / uSize, vec2(1.0) - vec2(0.5) / uSize);
  float rd = texture2D(tDepth, ruv).x, thick = behind;
  // (the ripple never fetches what is above the water: where the nudged pixel is in front of the surface, it is not nudged)
  if (rd < gl_FragCoord.z) ruv = uv;
  else thick = max(liquidDepth(rd) - zw, 0.0) * ray;
  vec3 under = texture2D(tScene, ruv).rgb;
  vec3 light = vLit;
  // (something that lights itself, a drowned screen: brighter than the room's light here, before the net is laid on)
  float lit = dot(under, vec3(0.299, 0.587, 0.114)) / max(dot(light, vec3(0.299, 0.587, 0.114)), 0.05);
  // light playing on the bed where the ray reaches it, fading with the water over it (and far faster in a murky one).
  // It only brightens what it lands on: what is under keeps its own colour
  vec3 dir = normalize(vRoom - uEyeRoom);
  float k = caustic(vRoom.xz + dir.xz * thick, slope, thick) * exp(-${f(LIQUID.causticFade / LIQUID.keep)} * uKeep.w * thick);
  vec3 bare = under;
  under *= 1.0 + uCaustic * k;
  // (but never past the brighter of itself and the room's light here: a pale step in shallow water is not lit up past
  // the deck beside it; a darker bed, which it cannot reach, is as it was)
  under *= min(1.0, max(dot(bare, vec3(0.299, 0.587, 0.114)), dot(light, vec3(0.299, 0.587, 0.114))) / max(dot(under, vec3(0.299, 0.587, 0.114)), 1e-5));
  // (inside a fresh ring the light on the bed is stirred: brighter for its first moments)
  if (uRingN > 0) under *= 1.0 + ${f(LIQUID.wakeStir)} * min(wk.w, 1.5) * (0.35 + k);
  // (uKeep: the water's own colours, scaled to its clearest, and how fast what it lets through at least falls)
  vec3 T = max(exp(-uAbsorb * thick), uKeep.rgb * exp(-uKeep.w * thick));
  // (and keeps more of its light than the water would leave it)
  T = mix(T, vec3(1.0) - (vec3(1.0) - T) * ${f(1 - LIQUID.glowKeep)}, smoothstep(0.9, 1.6, lit));
  vec3 col = under * T + uDeep * light * (1.0 - T)
    + uScatter * light * (1.0 - exp(-${f(LIQUID.scatterDepth)} * thick)) * exp(-${f(LIQUID.scatterFade)} * thick);
  float F = ${f(LIQUID.f0)} + ${f(1 - LIQUID.f0)} * pow(1.0 - max(dot(n, v), 0.0), 5.0);
  col = mix(col, reflection(n, v, uv, light), F);
  // the line where it meets what walls it in or stands in it, as bright as the room and what is under it
  float edge = 1.0 - smoothstep(${f(LIQUID.edge * 0.5)}, ${f(LIQUID.edge)}, behind);
  float seen = clamp(0.7 * dot(light, vec3(0.333)) + 0.5 * dot(under, vec3(0.4)), 0.0, 1.5);
  col = mix(col, ${v3(LIQUID.edgeColor)} * seen, edge * ${f(LIQUID.edgeMix)});
  // the wake's light and dark: its crest brighter, the trough just behind it darker (what the eye picks up across a pool)
  if (uRingN > 0) col *= 1.0 + (clamp(wk.y * ${f(LIQUID.wakeCrest)}, 0.0, 0.9) - clamp(wk.z * ${f(LIQUID.wakeTrough)}, 0.0, 0.35)) * (1.0 - edge);
  gl_FragColor = vec4(col, 1.0);
}`;

/** The copy: the scene's colour and depth as they are, into a plain pair at the same size. */
export const COPY_FRAG = `
uniform sampler2D tColor;
uniform sampler2D tDepth;
varying vec2 vUv;
void main() {
  gl_FragColor = texture2D(tColor, vUv);
  gl_FragDepthEXT = texture2D(tDepth, vUv).x;
}`;

// ---- the surface seen from below (the eye in the water) ----
// Under a surface that has its water below it, inside its rim, the eye sees the surface's underside: a dim skin, no
// mirror. Within the cone overhead that light from above gets through (Snell's window: the critical angle of water to
// air, 48.6 degrees from straight up, tilted by the ripple's stepped cells, so its edge is blocky like the top), what is
// above, a little bent by the ripple, darkened and tinted by the water between the eye and the surface; outside it, the
// pool's own colour, lit by the room. The room's veil (the waterpark's) is drawn over it as ever.
export const UNDERSIDE = Object.freeze({
  window: 0.661,      // the cosine of the critical angle, water to air: inside the cone, what is above; outside, the pool
  windowSoft: 0.03,   // its edge, softened by this much of the cosine either way
  through: 0.55,      // of what is above, at most, that the skin lets through (it is dim)
  bend: 0.06,         // how far the ripple's tilt moves what is seen through it, of the picture
  own: 0.7,           // outside the window: the water's deep colour lit by the room, times this
});

/**
 * Is the eye under a surface it should see the underside of? `eye` and `rim` in the surface's room frame (rim: the
 * sheet's extent, { x0, z0, x1, z1 }), `facesUp`: the sheet's water is below it (a pool, not the return pool's
 * upside-down upper pool, which keeps its own sheet). Under the plane but outside the rim (a lower room beside it): no.
 */
export function seesUnderside(eye, planeY, rim, facesUp, k = LIQUID) {
  return !!facesUp && !!rim && underwater(eye.y, planeY, k) && eye.x >= rim.x0 && eye.x <= rim.x1 && eye.z >= rim.z0 && eye.z <= rim.z1;
}

/** The underside's fragment shader: the top's own uniforms and functions, and the top's own ripple with the wake's rings
 * (the same cells, the same stepped slope: the window's edge is blocky as the top is, and a ring tilts it as it passes;
 * the wake's crest and trough light are the top's alone), then a main of its own. */
const TOP_MAIN = LIQUID_FRAG.slice(LIQUID_FRAG.lastIndexOf('void main() {'));
const TOP_SLOPE = TOP_MAIN.slice(0, TOP_MAIN.indexOf('\n', TOP_MAIN.indexOf('  vec3 n = normalize(uRoomToView')) + 1);
export const LIQUID_UNDER_FRAG = LIQUID_FRAG.slice(0, LIQUID_FRAG.lastIndexOf('void main() {')) + TOP_SLOPE + `  vec3 ray = normalize(vView);                               // from the eye up to the surface
  float cosUp = dot(ray, n);
  // the water between the eye and the surface
  float d = length(vView);
  vec3 T = max(exp(-uAbsorb * d), uKeep.rgb * exp(-uKeep.w * d));
  vec3 light = vLit;
  vec3 own = uDeep * light;
  // inside the window: what is above, nudged by the ripple's tilt (never to something in the water in front of it)
  vec2 ruv = clamp(uv + (n - up).xy * ${f(UNDERSIDE.bend)}, vec2(0.5) / uSize, vec2(1.0) - vec2(0.5) / uSize);
  if (texture2D(tDepth, ruv).x < gl_FragCoord.z) ruv = uv;
  vec3 above = texture2D(tScene, ruv).rgb * ${f(UNDERSIDE.through)};
  vec3 inside = above * T + own * (1.0 - T)
    + uScatter * light * (1.0 - exp(-${f(LIQUID.scatterDepth)} * d)) * exp(-${f(LIQUID.scatterFade)} * d);
  // outside it: the pool's own colour (what the underside mirrors is the pool, and the pool is that colour)
  vec3 outside = own * ${f(UNDERSIDE.own)};
  float w = smoothstep(${f(UNDERSIDE.window - UNDERSIDE.windowSoft)}, ${f(UNDERSIDE.window + UNDERSIDE.windowSoft)}, cosUp);
  gl_FragColor = vec4(mix(outside, inside, w), 1.0);
}`;
